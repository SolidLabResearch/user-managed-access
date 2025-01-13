import {Authorizer} from "./Authorizer";
import {ODRL, UconRequest, UCRulesStorage} from "@solidlab/ucp";
import {WEBID} from "../../credentials/Claims";
import {ODRLEvaluator, ODRLEngineMultipleSteps} from 'odrl-evaluator'
import {DataFactory, Store, Writer} from "n3";
import quad = DataFactory.quad;
import namedNode = DataFactory.namedNode;
import literal = DataFactory.literal;
import {generate_uuid} from "koreografeye";
import { getLoggerFor, RDF } from '@solid/community-server';
import {ClaimSet} from "../../credentials/ClaimSet";
import {Permission} from "../../views/Permission";
import {Requirements} from "../../credentials/Requirements";

export class OdrlAuthorizer implements Authorizer {
    protected readonly logger = getLoggerFor(this);
    private readonly odrlEvaluator: ODRLEvaluator;

    /**
     * Creates a OdrlAuthorizer enforcing policies using ODRL with the ODRL Evaluator.
     *
     * @param policies - A store containing the ODRL policy rules.
     */
    constructor(
        private readonly policies: UCRulesStorage,
    ) {
        const engine = new ODRLEngineMultipleSteps();
        this.odrlEvaluator = new ODRLEvaluator(engine);
    }

    public async permissions(claims: ClaimSet, query?: Permission[]): Promise<Permission[]> {
        this.logger.info(`Calculating permissions. ${JSON.stringify({claims, query})}`);
        console.log(claims)

        if (!query) {
            this.logger.warn('The OdrlAuthorizer can only calculate permissions for explicit queries.')
            return [];
        }

        this.logger.info(Object.keys(claims).length + " claim received")
        const requests: UconRequest[] = [];
        for (const {resource_id, resource_scopes} of query) {

            if (!resource_id) {
                this.logger.warn('The OdrlAuthorizer can only calculate permissions for explicit resources.');
                continue;
            }

            // ODRL can only handle odrl actions
            requests.push({
                subject: typeof claims[WEBID] === 'string' ? claims[WEBID] : 'urn:solidlab:uma:id:anonymous',
                resource: resource_id,
                action: resource_scopes ? transformActionsCssToOdrl(resource_scopes) : ["http://www.w3.org/ns/odrl/2/use"],
                claims
            });
        }
        const permissions: Permission[] = await Promise.all(requests.map(
            async (request) => {
                const scopes_permitted = [];

                // prepare sotw
                const sotw = new Store();

                sotw.add(quad(namedNode('http://example.com/request/currentTime'), namedNode('http://purl.org/dc/terms/issued'), literal(new Date().toISOString(), namedNode("http://www.w3.org/2001/XMLSchema#dateTime"))));

                // prepare policy
                const policyStore = (await this.policies.getStore())


                for (const action of request.action) {
                    // prepare request
                    const req = new Store();
                    const requestNode = generate_uuid();
                    const permissionNode = generate_uuid();
                    req.add(quad(requestNode, RDF.terms.type, ODRL.terms.Request));
                    req.add(quad(requestNode, ODRL.terms.permission, permissionNode));

                    req.add(quad(permissionNode, RDF.terms.type, ODRL.terms.Permission));
                    req.add(quad(permissionNode, ODRL.terms.assignee, namedNode(request.subject)));
                    req.add(quad(permissionNode, ODRL.terms.target, namedNode(request.resource)));
                    req.add(quad(permissionNode, ODRL.terms.action, namedNode(action)));

                    // evaluate policies
                    const reports = await this.odrlEvaluator.evaluate([...policyStore], [...req], [...sotw]);
                    const reportStore = new Store(reports)

                    // TODO: handle multiple reports -> possible to be generated
                    // fetch active and attempted
                    const permissionReportNode = reportStore.getQuads(null, "http://example.com/report/temp/rule", permissionNode, null);
                    if (permissionReportNode.length !== 1) {
                        this.logger.warn("Expected only one Permission Report. No permissions granted.");

                        console.log(new Writer().quadsToString([...policyStore]))
                        console.log(new Writer().quadsToString([...req]))
                        console.log(new Writer().quadsToString([...sotw]))
                        console.log(new Writer().quadsToString(reports))
                        break;
                    }
                    const activationState = reportStore.getObjects(permissionReportNode[0].subject, "http://example.com/report/temp/activationState", "http://example.com/report/temp/Active");
                    if (activationState.length === 1) {
                        scopes_permitted.push(action)
                    }
                }



                // extract allowed scopes
                return {
                    resource_id: request.resource,
                    resource_scopes: transformActionsOdrlToCss(scopes_permitted)
                }
            }
        ));
        // console.log(permissions)
        return permissions;
    }

    public async credentials(permissions: Permission[], query?: Requirements | undefined): Promise<Requirements[]> {
        throw new Error("Method not implemented.");
    }

}
const scopeCssToOdrl: Map<string, string> = new Map();
scopeCssToOdrl.set('urn:example:css:modes:read','http://www.w3.org/ns/odrl/2/read');
scopeCssToOdrl.set('urn:example:css:modes:append','http://www.w3.org/ns/odrl/2/append');
scopeCssToOdrl.set('urn:example:css:modes:create','http://www.w3.org/ns/odrl/2/create');
scopeCssToOdrl.set('urn:example:css:modes:delete','http://www.w3.org/ns/odrl/2/delete');
scopeCssToOdrl.set('urn:example:css:modes:write','http://www.w3.org/ns/odrl/2/write');

const scopeOdrlToCss : Map<string, string> = new Map(Array.from(scopeCssToOdrl, entry => [entry[1], entry[0]]));

function transformActionsCssToOdrl(actions: string[]): string[] {
    // scopes come from UmaClient.ts -> see CSS package

    // in UMAPermissionReader, only the last part of the URN will be used, divided by a colon
    // again, see CSS package
    return actions.map(action => scopeCssToOdrl.get(action)!);
}

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
