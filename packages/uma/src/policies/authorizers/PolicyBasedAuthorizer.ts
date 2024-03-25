import { Logger } from '../../util/logging/Logger';
import { getLoggerFor } from '../../util/logging/LoggerUtils';
import { Authorizer } from './Authorizer';
import { Permission } from '../../views/Permission';
import { Requirements, type ClaimVerifier } from '../../credentials/Requirements';
import { ClaimSet } from '../../credentials/ClaimSet';
import { ODRL, PolicyExecutor, UconRequest, 
  UcpPatternEnforcement, UcpPlugin, UCRulesStorage } from '@solidlab/ucp';
import { EyeJsReasoner } from "koreografeye";
import { lstatSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { WEBID } from '../../credentials/Claims';
import { RDF } from '@solid/community-server';

/**
 * An Authorizer granting access according to Usage Control Policies.
 */
export class PolicyBasedAuthorizer implements Authorizer {
  protected readonly logger: Logger = getLoggerFor(this);

  private reasoner: EyeJsReasoner = new EyeJsReasoner(["--quiet", "--nope", "--pass"]);
  private plugins = { "http://example.org/dataUsage": new UcpPlugin() };
  private executor = new PolicyExecutor(this.plugins);
  private enforcer: UcpPatternEnforcement;

  /**
   * Creates a PublicNamespaceAuthorizer with the given public namespaces.
   * 
   * @param rules - A store containing the UCP policy rules.
   * @param enforcer - The UcpPatternEnforcement engine.
   */
  constructor(
    // protected enforcer: UcpPatternEnforcement
    private readonly policies: UCRulesStorage,
    private readonly rulesDir: string,
  ) {
    if (!lstatSync(this.rulesDir).isDirectory()) {
      throw Error(`${this.rulesDir} does not resolve to a directory`)
    }
    const ruleSet = readdirSync(this.rulesDir).map(file => {
      return readFileSync(path.join(this.rulesDir, file)).toString();
    });
    this.enforcer = new UcpPatternEnforcement(this.policies, ruleSet, this.reasoner, this.executor)
  }


  /** @inheritdoc */
  public async permissions(claims: ClaimSet, query?: Partial<Permission>[]): Promise<Permission[]> {
    this.logger.info('Calculating permissions.', { claims, query });

    if (!query) {
      this.logger.warn('The PolicyBasedAuthorizer can only calculate permissions for explicit queries.')
      return [];
    }

    const requests: UconRequest[] = [];
    for (const { resource_id, resource_scopes} of query) {

      if (!resource_id) {
        this.logger.warn('The PolicyBasedAuthorizer can only calculate permissions for explicit resources.');
        continue;
      }

      requests.push({
        subject: typeof claims[WEBID] === 'string' ? claims[WEBID] : 'urn:solidlab:uma:id:anonymous',
        resource: resource_id,
        action: resource_scopes ?? [ "http://www.w3.org/ns/odrl/2/use" ],
        claims
      });
    }

    const permissions: Permission[] = await Promise.all(requests.map(
      async (request) => ({
        resource_id: request.resource,
        resource_scopes: await this.enforcer.calculateAccessModes(request)
      })
    ));

    return permissions;
  }

  /** @inheritdoc */
  public async credentials(permissions: Permission[], query?: Requirements): Promise<Requirements[]> {
    this.logger.info('Calculating credentials.', { permissions, query });
    
    // No permissions => empty requirements
    if (permissions.length === 0) return [{}];

    const policyStore = await this.policies.getStore();
    const requirements: Requirements[] = [];
    
    const policyPermissions = policyStore.getSubjects(RDF.terms.type, ODRL.terms.Permission, null);
    
    // No policies => no solvable requirements
    if (policyPermissions.length === 0) return [];
    
    for (const policyPermission of policyPermissions) {
      const verifiers: Record<string, ClaimVerifier> = {};
      
      // TODO: remove this default and treat webid as any claim
      const webids = policyStore.getObjects(policyPermission, ODRL.terms.assignee, null).map(webid => webid.value);
      verifiers[WEBID] = async (webid: string) => webids.includes(webid);

      const constraints = policyStore.getObjects(policyPermission, ODRL.terms.constraint, null);

      for (const constraint of constraints) {
        const leftOperand = policyStore.getObjects(constraint, ODRL.terms.leftOperand, null)[0];
        const operator = policyStore.getObjects(constraint, ODRL.terms.operator, null)[0];
        const rightOperand = policyStore.getObjects(constraint, ODRL.terms.rightOperand, null)[0];

        if (operator.value !== ODRL.lt && operator.value !== ODRL.gt && operator.value !== ODRL.eq) {
          this.logger.warn(`Cannot handle operator <${operator.value}>.`);
          continue;
        }

        // Skip dateTime constraints, since this is included in the rules.
        if (leftOperand.value === ODRL.dateTime) continue;

        // TODO: Support any ODRL constraint
        verifiers[leftOperand.value] = async (arg: any) => {
          switch (operator.value) {
            case ODRL.lt: return arg < rightOperand.value;
            case ODRL.gt: return arg > rightOperand.value;
            default: return arg === rightOperand.value;
          }
        };
      }

      requirements.push(verifiers);
    }

    if (query && !Object.keys(requirements).every(r => Object.keys(query).includes(r))) {
      return [];
    }

    return requirements;
  }
}
