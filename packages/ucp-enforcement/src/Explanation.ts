import { Store, DataFactory } from "n3";
import { AccessMode } from "./UMAinterfaces"
import { UconRequest, createContext } from "./Request"
import { v4 as uuidv4 } from 'uuid';
import { accesModesAllowed } from "./util/constants";
import { SimplePolicy } from "./util/Util";
import { storeToString } from "./util/Conversion";
const { namedNode, literal } = DataFactory

export interface Explanation {
    /**
     * The access modes allowed.
     */
    decision: AccessMode[],
    /**
     * The input request used as premise.
     */
    request: {
        raw: UconRequest
    },
    /**
     * The algorithm used to calculate the decision based on the conclusions.
     */
    algorithm: DecisionAlgorithm,
    /**
     * The conclusions of the reasoner.
     * Knowledge base: the input request + all the usage control rules.
     * Reasoning rules: N3 rules.
     */
    conclusions: Conclusion[]
}

/**
 * Different kinds of decision algorithms which can be used to calculate the grant decisions for the {@link Explanation}
 */
export enum DecisionAlgorithm {
    /**
     * The decision will be based on the **union** of all the grants of the {@link Conclusion | conclusions}.
     */
    Union = "Union",
    /**
     * The decision will be based on the **intersection** of all the grants of the {@link Conclusion | conclusions}.
     */
    Intersection = "Intersection",
    /**
     * The decision will be based on binary operators of the **policies** to which the {@link Conclusion | conclusions} belong.
     * If the policies don't explicitly state on how to interpret the multiple rules, **intersection** on the grants of the rules (r1 AND r2 ... ri) will be used.
     */
    Policy = "Policy"
}

/**
 * A rule that was actived through the reasoning together with it its conclusion (which is parsed).
 */
export interface Conclusion {
    /**
     * The identifier of the usage control rule.
     */
    ruleIRI: string,
    /**
     * The identifier of an N3 rule.
     * In particular the rule that was active on both the rule and the request.
     */
    interpretationIRI: string,
    /**
     * The resulting grants allowed throught the reasoning.
     * (part of the conclusion of the rule)
     */
    grants: AccessMode[],
    /**
     * The time at which the reasoning happened.
     * (part of the conclusion of the rule)
     */
    timestamp: Date
}

export function explanationToRdf(explanation: Explanation): Store {
    const store = new Store()
    const baseIRI = 'http://example.org/'
    const explanationIRI = `${baseIRI}explanation`
    const explanationNode = namedNode(explanationIRI)

    // decision
    for (const accessMode of explanation.decision) {
        store.addQuad(explanationNode, namedNode(accesModesAllowed), namedNode(accessMode));
    }

    // algorithm
    store.addQuad(explanationNode, namedNode(baseIRI + 'algorithmUsed'), literal(explanation.algorithm));

    // request
    store.addQuad(explanationNode, namedNode(baseIRI + 'request'), namedNode('http://example.org/context')) // Note: currently hardcoded request IRI from createContext
    store.addQuads(createContext(explanation.request.raw).getQuads(null, null, null, null))

    // conclusions
    for (const conclusion of explanation.conclusions) {
        const conclusionIri = baseIRI + uuidv4();
        const conclusionPred = namedNode(baseIRI + 'conclusion');
        const conclusionNode = namedNode(conclusionIri);
        store.addQuad(explanationNode, conclusionPred, conclusionNode);
        store.addQuad(conclusionNode, namedNode(baseIRI + 'uconRule'), namedNode(conclusion.ruleIRI));
        store.addQuad(conclusionNode, namedNode(baseIRI + 'N3InterpetationRule'), namedNode(conclusion.interpretationIRI));
        store.addQuad(conclusionNode, namedNode('http://purl.org/dc/terms/issued'), literal(conclusion.timestamp.toISOString(), namedNode('http://www.w3.org/2001/XMLSchema#dateTime')));

        for (const accessMode of conclusion.grants) {
            store.addQuad(conclusionNode, namedNode(accesModesAllowed), namedNode(accessMode));
        }

    }
    return store
}
/**
 * Serialize the request together with a set of ucon rules and set of N3 rules interpreting into a single string.
 * 
 * This string can be given to an N3 reasoning engine. 
 * When there is a conclusion, one or multiple rule activations will occur. (rule must be seen in the context of a policy rule)
 * Each rule activation contains permissions granted.
 * @param policies
 * @param request
 * @param rules
 */

export function serializePremises(policies: SimplePolicy[], request: UconRequest, n3Rules: string): string {
    // get string representation of the policies
    let policiesString = "";
    for (const createdPolicy of policies) {
        policiesString += storeToString(createdPolicy.representation);
    } // create context request
    const context = storeToString(createContext(request));
    // create file with N3 rules, context and policy
    return [policiesString, context, n3Rules].join('\n');
}
/**
 * Serialize the full explanation with the whole context into Notation3.
 * Whole context includes:
 * - request
 * - ucon rules set
 * - n3 intepretation rules
 * @param explanation 
 * @param uconRules 
 * @param n3InterpretationRules 
 * @returns 
 */
export function serializeFullExplanation(explanation: Explanation, uconRules: Store, n3InterpretationRules: string): string {
    const explanationString = storeToString(explanationToRdf(explanation));
    const uconRulesString = storeToString(uconRules);
    return [explanationString, uconRulesString, n3InterpretationRules].join('\n');
}