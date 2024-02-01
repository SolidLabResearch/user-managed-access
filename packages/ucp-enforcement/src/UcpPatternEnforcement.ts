import { Reasoner } from "koreografeye";
import { Store } from "n3";
import { Conclusion, DecisionAlgorithm, Explanation } from "./Explanation";
import { PolicyExecutor as IPolicyExecutor } from "./PolicyExecutor";
import { UconRequest } from "./Request";
import { AccessMode } from "./UMAinterfaces";
import { UCRulesStorage } from "./storage/UCRulesStorage";
import { createContext } from "./Request";

/**
 * Can calculate Access Modes based on an UMA request, ODRL Rules and N3 Rules using the Koreografeye flow.
 * Currently, prohibitions are not taken into account.
 */
export class UcpPatternEnforcement implements UconEnforcementDecision {


    constructor(private uconRulesStorage: UCRulesStorage, private koreografeyeOdrlRules: string[], private reasoner: Reasoner, private executor: IPolicyExecutor) {

    }

    /**
     * Calculates the access modes allowed based using Koreografeye
     * The instantiation of the Usage Control Policies are given to this class as an RDF Graph which contain {@link https://www.w3.org/TR/odrl-model/#rule | ODRL Rules}.
     * On these, reasoning is applied with N3 Rules. Those N3 rules have as conclusion a koreografeye Policy.
     * The conclusion of the reasoning results into a graph with 0..n policies, which are then executed by the plugins. This executioner and plugins are given by the {@link IPolicyExecutor}
     *   If there are zero policies in the conclusion, a request will be sent to the Resource Owner. Furthermore, the user is notified that more information is needed. TODO:
     *   Otherwise, {@link AccessMode | Access modes} are obtained from all the Koreografeye Plugin executions.
     * Finally, all the obtained {@link AccessMode | Access modes} are returned
     * 
     * @param context Context about the client and the request, parsed by an UMA Server.
     * @returns 
     */
    async calculateAccessModes(request: UconRequest): Promise<AccessMode[]> {
        // go from context to an RDF graph that contains all context
        const contextStore = createContext(request)

        const reasoningInputStore = new Store()

        reasoningInputStore.addQuads((await this.uconRulesStorage.getStore()).getQuads(null, null, null, null))
        reasoningInputStore.addQuads(contextStore.getQuads(null, null, null, null))

        // TODO: remove in production
        // console.log("input:");
        // console.log(await rdfTransformStore(reasoningInputStore, 'text/turtle'));

        // Reason using ODRL Rules and N3 Rules
        const reasoningResult = await this.reasoner.reason(reasoningInputStore, this.koreografeyeOdrlRules);

        // TODO: remove in production
        // console.log("reasoning output:");
        // console.log(await rdfTransformStore(reasoningResult, 'text/turtle'));

        // Execute policies
        const accessModes: AccessMode[] = []
        const executedPolicies = await this.executor.executePolicies(reasoningResult)
        // if no policies -> ask owner for request -> plugin?
        if (executedPolicies.length === 0) {
            // no access
            // TODO: ask owner access
            // TODO: let user know that there is no access
            console.log(`[${new Date().toISOString()}] - UcpPatternEnforcement: no policies`);
        }
        // if policies -> executePolicy: return value accessmodes in an object somehow?
        for (const executedPolicy of executedPolicies) {
            accessModes.push(...executedPolicy.result)
        }
        return accessModes
    }

    async calculateAndExplainAccessModes(request: UconRequest): Promise<Explanation> {
        const contextStore = createContext(request)

        const knowledgeBase = new Store()

        knowledgeBase.addQuads((await this.uconRulesStorage.getStore()).getQuads(null, null, null, null))
        knowledgeBase.addQuads(contextStore.getQuads(null, null, null, null))

        const reasoningResult = await this.reasoner.reason(knowledgeBase, this.koreografeyeOdrlRules);

        const conclusions: Conclusion[] = []
        const executedPolicies = await this.executor.executePolicies(reasoningResult)

        if (executedPolicies.length === 0) {
            // based on all the rules, no access
        }

        for (const executedPolicy of executedPolicies) {
            // expect that the result of the executedPolicy consists of:
            //  * usage control rule identifier
            //  * N3 interpretation rule identifier
            //  * time issued
            //  * access modes granted

            // if not, throw Error -> the wrong plugin is used | Note: throwing error is not happening yet

            conclusions.push(executedPolicy.result)
        }

        // calculation of decision based on the algorithm and the conclusions
        // Note: currently hardcoded to be the union.
        const grants = conclusions.map(conclusion => conclusion.grants).flat()
        // remove the duplicates
        const decision = Array.from(new Set(grants))
        return {
            decision: decision,
            request: {
                raw: request
            },
            algorithm: DecisionAlgorithm.Union,
            conclusions: conclusions,
        }
    }
}

export interface UconEnforcementDecision {
    /**
     * Calculates the modes granted (i.e. the `actions`) based on the request and the configured Usage Control Rules and how they are interpreted.
     * 
     * @param request A parsed Usage Request containing `who` wants to perform `which action` on a given `resource` with a given `context`. 
     * @returns A list of Access Modes
     */
    calculateAccessModes: (request: UconRequest) => Promise<AccessMode[]>;

    /**
     * Calculates the modes granted (i.e. which `actions`) based on the request and the configured Usage Control Rules and how they are interpreted.
     * Furthermore, it provides a proof + algorithm of how the decision for an access grant is calculated.
     * 
     * @param request A parsed Usage Request containing `who` wants to perform `which action` on a given `resource` with a given `context`. 
     * @returns The explanation (which includes the Access Modes)
     */
    calculateAndExplainAccessModes: (request: UconRequest) => Promise<Explanation>;
}
