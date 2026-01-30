import { DC, RDF } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { DataFactory, Literal, NamedNode, Quad, Quad_Subject, Store, Writer } from 'n3';
import { EyeReasoner, ODRLEngineMultipleSteps, ODRLEvaluator } from 'odrl-evaluator'
import { createVocabulary } from 'rdf-vocabulary';
import { CLIENTID, WEBID } from '../../credentials/Claims';
import { ClaimSet } from '../../credentials/ClaimSet';
import { basicPolicy } from '../../ucp/policy/ODRL';
import { UCPPolicy } from '../../ucp/policy/UsageControlPolicy';
import { UCRulesStorage } from '../../ucp/storage/UCRulesStorage';
import { ODRL } from '../../ucp/util/Vocabularies';
import { Permission } from '../../views/Permission';
import { Authorizer } from './Authorizer';

const { quad, namedNode, literal, blankNode } = DataFactory

/**
 * Permission evaluation is performed as follows:
 *
 * 1. Conversion of Permission queries to ODRL Requests.
 *    - A translation is performed to transform CSS actions to ODRL actions.
 *    - One ODRL Request per Action and target Resource.
 *
 * 2. ODRL Evaluator performs ODRL Evaluation
 *    - No policy selection is performed (all policies are inserted rather than all relevant).
 *    - No conflict resolution strategy is present (Prohibition policies are ignored).
 *    - No duties are checked.
 *
 * 3. Conversion from ODRL Policy Compliance Reports to Permissions
 *    - Selecting the ODRL actions from Active Permission Reports
 *    - Translation from ODRL actions to CSS actions
 */
export class OdrlAuthorizer implements Authorizer {
    protected readonly logger = getLoggerFor(this);
    private readonly odrlEvaluator: ODRLEvaluator;

    /**
     * Creates a OdrlAuthorizer enforcing policies using ODRL with the ODRL Evaluator.
     *
     *
     * @param policies - A store containing the ODRL policy rules.
     * @param eyePath - The path to run the local EYE reasoner, if there is one.
     */
    constructor(
        private readonly policies: UCRulesStorage,
        eyePath?: string,
    ) {
        const engine = eyePath ?
          new ODRLEngineMultipleSteps({reasoner: new EyeReasoner(eyePath, ["--quiet", "--nope", "--pass-only-new"])}) :
          new ODRLEngineMultipleSteps();
        this.odrlEvaluator = new ODRLEvaluator(engine);
    }

    public async permissions(claims: ClaimSet, query?: Permission[]): Promise<Permission[]> {
        this.logger.info(`Calculating permissions. ${JSON.stringify({claims, query})}`);
        if (!query) {
            this.logger.warn('The OdrlAuthorizer can only calculate permissions for explicit queries.')
            return [];
        }

        // key value store for building the permissions to be granted on a resource
        const grantedPermissions: { [key: string]: string[] } = {};

        // prepare policy
        const policyStore = (await this.policies.getStore())

        // prepare sotw
        const sotw = new Store();
        sotw.add(quad(
          namedNode('http://example.com/request/currentTime'),
          namedNode('http://purl.org/dc/terms/issued'),
          literal(new Date().toISOString(), namedNode("http://www.w3.org/2001/XMLSchema#dateTime"))),
        );

        const subject = typeof claims[WEBID] === 'string' ? claims[WEBID] : 'urn:solidlab:uma:id:anonymous';
        const clientQuads: Quad[] = [];
        const clientSubject = blankNode();
        if (typeof claims[CLIENTID] === 'string') {
            clientQuads.push(
                quad(clientSubject, RDF.terms.type, ODRL.terms.Constraint),
                // TODO: using purpose as other constraints are not supported in current version of ODRL evaluator
                //       https://github.com/SolidLabResearch/ODRL-Evaluator/blob/v0.5.0/ODRL-Support.md#left-operands
                quad(clientSubject, ODRL.terms.leftOperand, namedNode(ODRL.namespace + 'purpose')),
                quad(clientSubject, ODRL.terms.operator, ODRL.terms.eq),
                quad(clientSubject, ODRL.terms.rightOperand, namedNode(claims[CLIENTID])),
            );
            // constraints.push({
            //     type: ODRL.namespace + 'deliveryChannel',
            //     operator: ODRL.eq,
            //     value: namedNode(claims[CLIENTID]),
            // });
        }

        for (const {resource_id, resource_scopes} of query) {
            grantedPermissions[resource_id] = [];
            for (const scope of resource_scopes) {
                // TODO: why is this transformation happening (here)?
                //       IMO this should either happen on the RS,
                //       or the policies should just use the "CSS" modes (not really though)
                const action = scopeCssToOdrl.get(scope) ?? scope;
                this.logger.info(`Evaluating Request [S R AR]: [${subject} ${resource_id} ${action}]`);
                const requestPolicy: UCPPolicy = {
                    type: ODRL.Request,
                    rules: [
                        {
                            action: action,
                            resource: resource_id,
                            requestingParty: subject
                        }
                    ]
                }
                const request = basicPolicy(requestPolicy);
                const requestStore = request.representation
                // Adding context triples for the client identifier, if there is one
                if (clientQuads.length > 0) {
                    requestStore.addQuad(quad(
                      namedNode(request.ruleIRIs[0]),
                      namedNode('https://w3id.org/force/sotw#context'),
                      clientSubject,
                    ));
                    requestStore.addQuads(clientQuads);
                }

                // evaluate policies
                const reports = await this.odrlEvaluator.evaluate(
                    [...policyStore],
                    [...requestStore],
                    [...sotw]);
                const reportStore = new Store(reports);

                // TODO: handle multiple reports -> possible to be generated
                // NOTE: current strategy, add all actions of active reports generated by the request
                // fetch active and attempted
                const PolicyReportNodes = reportStore.getSubjects(RDF.type, CR.PolicyReport, null);
                for (const policyReportNode of PolicyReportNodes) {
                    const policyReport = parseComplianceReport(policyReportNode, reportStore)
                    const activeReports = policyReport.ruleReport.filter(
                      (report) => report.activationState === ActivationState.Active);
                    if (activeReports.length > 0 && activeReports[0].type === RuleReportType.PermissionReport) {
                        grantedPermissions[resource_id].push(scope);
                    }
                }
            }
        }
        const permissions: Permission[] = []
        Object.keys(grantedPermissions).forEach(
            resource_id => permissions.push({
                resource_id,
                resource_scopes: grantedPermissions[resource_id],
            }) );
        return permissions;
    }
}
const scopeCssToOdrl: Map<string, string> = new Map();
scopeCssToOdrl.set('urn:example:css:modes:read','http://www.w3.org/ns/odrl/2/read');
scopeCssToOdrl.set('urn:example:css:modes:append','http://www.w3.org/ns/odrl/2/append');
scopeCssToOdrl.set('urn:example:css:modes:create','http://www.w3.org/ns/odrl/2/create');
scopeCssToOdrl.set('urn:example:css:modes:delete','http://www.w3.org/ns/odrl/2/delete');
scopeCssToOdrl.set('urn:example:css:modes:write','http://www.w3.org/ns/odrl/2/write');

const scopeOdrlToCss : Map<string, string> = new Map(Array.from(scopeCssToOdrl, entry => [entry[1], entry[0]]));

type PolicyReport = {
    id: NamedNode;
    created: Literal;
    request: NamedNode;
    policy: NamedNode;
    ruleReport: RuleReport[];
}
type RuleReport = {
    id: NamedNode;
    type: RuleReportType;
    activationState: ActivationState
    rule: NamedNode;
    requestedRule: NamedNode;
    premiseReport: PremiseReport[]
}

type PremiseReport = {
    id: NamedNode;
    type:PremiseReportType;
    premiseReport: PremiseReport[];
    satisfactionState: SatisfactionState
}

// is it possible to just use CR.namespace + "term"?
// https://github.com/microsoft/TypeScript/issues/40793
enum RuleReportType {
    PermissionReport= 'https://w3id.org/force/compliance-report#PermissionReport',
    ProhibitionReport= 'https://w3id.org/force/compliance-report#ProhibitionReport',
    ObligationReport= 'https://w3id.org/force/compliance-report#ObligationReport',
}
enum SatisfactionState {
    Satisfied= 'https://w3id.org/force/compliance-report#Satisfied',
    Unsatisfied= 'https://w3id.org/force/compliance-report#Unsatisfied',
}

enum PremiseReportType {
    ConstraintReport = 'https://w3id.org/force/compliance-report#ConstraintReport',
    PartyReport = 'https://w3id.org/force/compliance-report#PartyReport',
    TargetReport = 'https://w3id.org/force/compliance-report#TargetReport',
    ActionReport = 'https://w3id.org/force/compliance-report#ActionReport',
}

enum ActivationState {
    Active= 'https://w3id.org/force/compliance-report#Active',
    Inactive= 'https://w3id.org/force/compliance-report#Inactive',
}

/**
 * Parses an ODRL Compliance Report Model into a {@link PolicyReport}.
 * @param identifier
 * @param store
 */
function parseComplianceReport(identifier: Quad_Subject, store: Store): PolicyReport {
    const exists = store.getQuads(identifier,RDF.type,CR.PolicyReport, null).length === 1;
    if (!exists) { throw Error(`No Policy Report found with: ${identifier}.`); }
    const ruleReportNodes = store.getObjects(identifier, CR.ruleReport, null) as NamedNode[];

    return {
        id: identifier as NamedNode,
        created: store.getObjects(identifier, DC.namespace+"created", null)[0] as Literal,
        policy: store.getObjects(identifier, CR.policy, null)[0] as NamedNode,
        request: store.getObjects(identifier, CR.policyRequest, null)[0] as NamedNode,
        ruleReport: ruleReportNodes.map(ruleReportNode => parseRuleReport(ruleReportNode, store))
    }
}

/**
 * Parses Rule Reports from a Compliance Report, including its premises
 * @param identifier
 * @param store
 */
function parseRuleReport(identifier: Quad_Subject, store: Store): RuleReport {
    const premiseNodes = store.getObjects(identifier,CR.premiseReport, null) as NamedNode[];
    return {
        id: identifier as NamedNode,
        type: store.getObjects(identifier, RDF.type, null)[0].value as RuleReportType,
        activationState: store.getObjects(identifier, CR.activationState, null)[0].value as ActivationState,
        requestedRule: store.getObjects(identifier, CR.ruleRequest, null)[0] as NamedNode,
        rule: store.getObjects(identifier, CR.rule, null)[0] as NamedNode,
        premiseReport: premiseNodes.map((prem) => parsePremiseReport(prem, store))
    }
}

/**
 * Parses Premise Reports, including premises of a Premise Report itself.
 * Note that if for some reason there are circular premise reports, this will result into an infinite loop
 * @param identifier
 * @param store
 */
function parsePremiseReport(identifier: Quad_Subject, store: Store): PremiseReport {
    const nestedPremises = store.getObjects(identifier, CR.PremiseReport, null) as NamedNode[];
    return {
        id: identifier as NamedNode,
        type: store.getObjects(identifier, RDF.type, null)[0].value as PremiseReportType,
        premiseReport: nestedPremises.map((prem) => parsePremiseReport(prem, store)),
        satisfactionState: store.getObjects(identifier, CR.satisfactionState, null)[0].value as SatisfactionState
    }
}
const CR = createVocabulary('https://w3id.org/force/compliance-report#',
    'PolicyReport',
    'RuleReport',
    'PermissionReport',
    'ProhibitionReport',
    'DutyReport',
    'PremiseReport',
    'ConstraintReport',
    'PartyReport',
    'ActionReport',
    'TargetReport',
    'ActivationState',
    'Active',
    'Inactive',
    'AttemptState',
    'Attempted',
    'NotAttempted',
    'PerformanceState',
    'Performed',
    'Unperformed',
    'Unknown',
    'DeonticState',
    'NonSet',
    'Violated',
    'Fulfilled',
    'SatisfactionState',
    'Satisfied',
    'Unsatisfied',
    'policy',
    'policyRequest',
    'ruleReport',
    'conditionReport',
    'premiseReport',
    'rule',
    'ruleRequest',
    'activationState',
    'attemptState',
    'performanceState',
    'deonticState',
    'constraint',
    'satisfactionState',
    )
