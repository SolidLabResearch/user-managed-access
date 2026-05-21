import { BadRequestHttpError, NotImplementedHttpError } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { ClaimSet } from '../../credentials/ClaimSet';
import { Requirements } from '../../credentials/Requirements';
import { UCRulesStorage } from '../../ucp/storage/UCRulesStorage';
import { Permission } from '../../views/Permission';
import { Authorizer } from './Authorizer';
import { FastOdrlPolicyEvaluator } from './FastOdrlPolicyEvaluator';

/**
 * Permission evaluation is performed as follows:
 *
 * 1. CSS actions are translated to their ODRL equivalents.
 * 2. Policies are matched in-process against the supported ODRL subset.
 * 3. Granted ODRL actions are translated back to CSS scopes.
 *
 * The supported subset intentionally matches what this authorizer used before:
 * Permission rules, assignee/action/target matching, simple constraints, and
 * AssetCollection membership. Prohibitions, duties, and conflict resolution are
 * not implemented.
 */
export class OdrlAuthorizer implements Authorizer {
    protected readonly logger = getLoggerFor(this);
    private readonly evaluator = new FastOdrlPolicyEvaluator();

    /**
     * Creates an OdrlAuthorizer enforcing the supported ODRL policy subset.
     * @param policies - A store containing the ODRL policy rules.
     * @param eyePath - Kept for config compatibility. The in-process evaluator no longer uses EYE.
     */
    constructor(
        private readonly policies: UCRulesStorage,
        eyePath?: string,
    ) {}

    public async permissions(claims: ClaimSet, query?: Permission[]): Promise<Permission[]> {
        this.logger.info(`Calculating permissions. ${JSON.stringify({claims, query})}`);
        if (!query) {
            this.logger.warn('The OdrlAuthorizer can only calculate permissions for explicit queries.')
            return [];
        }

        // key value store for building the permissions to be granted on a resource
        const grantedPermissions: { [key: string]: string[] } = {};

        const policyStore = await this.policies.getStore();
        const policyIndex = this.evaluator.createIndex(policyStore);

        for (const {resource_id, resource_scopes} of query) {
            grantedPermissions[resource_id] = [];
            const actions = transformActionsCssToOdrl(resource_scopes);
            for (const action of actions) {
                this.logger.info(`Evaluating Request [R AR]: [${resource_id} ${action}]`);
                if (policyIndex.evaluate(claims, resource_id, action)) {
                    grantedPermissions[resource_id].push(action);
                }
            }
        }
        const permissions: Permission[] = []
        Object.keys(grantedPermissions).forEach(
            resource_id => permissions.push({
                resource_id,
                resource_scopes: transformActionsOdrlToCss(grantedPermissions[resource_id])
            }) );
        return permissions;
    }

    public async credentials(permissions: Permission[], query?: Requirements | undefined): Promise<Requirements[]> {
        throw new NotImplementedHttpError('Method not implemented.');
    }

}
const scopeCssToOdrl: Map<string, string> = new Map();
scopeCssToOdrl.set('urn:example:css:modes:read','http://www.w3.org/ns/odrl/2/read');
scopeCssToOdrl.set('urn:example:css:modes:append','http://www.w3.org/ns/odrl/2/append');
scopeCssToOdrl.set('urn:example:css:modes:create','http://www.w3.org/ns/odrl/2/create');
scopeCssToOdrl.set('urn:example:css:modes:delete','http://www.w3.org/ns/odrl/2/delete');
scopeCssToOdrl.set('urn:example:css:modes:write','http://www.w3.org/ns/odrl/2/write');

const scopeOdrlToCss : Map<string, string> = new Map(Array.from(scopeCssToOdrl, entry => [entry[1], entry[0]]));

/**
 * Transform the Actions enforced by the Community Solid Server to equivalent ODRL Actions
 * @param actions
 */
function transformActionsCssToOdrl(actions: string[]): string[] {
    // scopes come from UmaClient.ts -> see CSS package

    // in UMAPermissionReader, only the last part of the URN will be used, divided by a colon
    // again, see CSS package
    return actions.map(action => {
      const result = scopeCssToOdrl.get(action);
      if (!result) {
        throw new BadRequestHttpError(`Unsupported action ${action}`);
      }
      return result;
    });
}
/**
 * Transform ODRL Actions to equivalent Actions enforced by the Community Solid Server
 * @param actions
 */
function transformActionsOdrlToCss(actions: string[]): string[] {
    const cssActions = []
    for (const action of actions) {
        if (action === 'http://www.w3.org/ns/odrl/2/use'){
            return Array.from(scopeCssToOdrl.keys());
        }
        cssActions.push(scopeOdrlToCss.get(action)!);
    }
    return cssActions;
}
