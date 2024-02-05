import { Logger } from '../../util/logging/Logger';
import { getLoggerFor } from '../../util/logging/LoggerUtils';
import { ANY_RESOURCE, ANY_SCOPE, Authorizer } from './Authorizer';
import { Permission } from '../../views/Permission';
import { Requirements } from '../../credentials/Requirements';
import { ClaimSet } from '../../credentials/ClaimSet';
import { AccessMode, DirectoryUCRulesStorage, PolicyExecutor, UconRequest, 
  UcpPatternEnforcement, UcpPlugin, UCRulesStorage } from '@solidlab/uma-enforcement';
import { EyeJsReasoner } from "koreografeye";
import { readFileSync } from 'fs';

/**
 * An Authorizer granting access according to Usage Control Policies.
 */
export class PolicyBasedAuthorizer implements Authorizer {
  protected readonly logger: Logger = getLoggerFor(this);

  private reasoner: EyeJsReasoner = new EyeJsReasoner(["--quiet", "--nope", "--pass"]);
  private plugins = { "http://example.org/dataUsage": new UcpPlugin() };
  private executor = new PolicyExecutor(this.plugins);
  private enforcer: UcpPatternEnforcement;
  private rules: UCRulesStorage;
  private n3: string;

  /**
   * Creates a PublicNamespaceAuthorizer with the given public namespaces.
   * 
   * @param rules - A store containing the UCP policy rules.
   * @param enforcer - The UcpPatternEnforcement engine.
   */
  constructor(
    // protected rules: UCRulesStorage,
    // protected enforcer: UcpPatternEnforcement
    policyDir: string,
    n3Rules: string,
  ) {
    this.rules = new DirectoryUCRulesStorage(policyDir);
    this.n3 = readFileSync(n3Rules).toString();
    this.enforcer = new UcpPatternEnforcement(this.rules, [this.n3], this.reasoner, this.executor)
  }


  /** @inheritdoc */
  public async permissions(claims: ClaimSet, query?: Partial<Permission>[]): Promise<Permission[]> {
    this.logger.info('Calculating permissions.', { claims, query });

    const webid = claims['webid'];
    const subject = typeof webid === 'string' ? webid : 'urn:solidlab:uma:id:anonymous';

    const request: UconRequest = query && query.length > 0 ? {
      subject,
      resource: query[0].resource_id ?? ANY_RESOURCE,
      action: query[0].resource_scopes ?? [ANY_SCOPE],
    } : {
      subject,
      resource: ANY_RESOURCE,
      action: [ANY_SCOPE],
    };

    const accessModes: AccessMode[] = await this.enforcer.calculateAccessModes(request);

    return [{
      resource_id: request.resource,
      resource_scopes: accessModes
    }]
  }

  /** @inheritdoc */
  public async credentials(permissions: Permission[], query?: Requirements): Promise<Requirements> {
    throw new Error('Not implemented');
  }
}
