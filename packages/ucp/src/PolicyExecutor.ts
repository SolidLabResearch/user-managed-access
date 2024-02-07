import * as N3 from 'n3';
import * as RDF from '@rdfjs/types';
import { Store } from 'n3';
import { Logger, getLogger } from 'log4js';
import { extractGraph, extractPolicies } from 'koreografeye';

export type IPolicyType = {
    node: N3.NamedNode | N3.BlankNode,
    // Policy node
    path: string,        // Input file
    policy: string,      // Policy identifier
    target: string,      // Name of execution target (the idenfier of the policy function)
    order: number,       // Execution order of policy
    args: {               // Name/Value pairs of policy arguments
        [key: string]: RDF.Term[]
    }
};

export abstract class PolicyPlugin {

    constructor() {

    }

    public abstract execute(mainStore: N3.Store, policyStore: N3.Store, policy: IPolicyType): Promise<any>;
}

export type IPolicyExecution = {
    policy: IPolicyType,
    result: any
};

export interface IPolicyExecutor {

    /**
     * Extracts policies out of the graph based on the {@link https://fno.io/spec/#fn-execution | `fno:Execution`} and {@link https://fno.io/spec/#fn-executes | `fno:executes` } triples.
     * When they are extracted, the Koreografeye Plugins are executed.
     * 
     * Note that the graph must contain both the input given to the reasoner (minus the N3 rules) and the conclusions.
     * @param store 
     */
    executePolicies(store: Store): Promise<IPolicyExecution[]>
}

export class PolicyExecutor implements IPolicyExecutor {
    private logger: Logger;

    constructor(private plugins: { [n: string]: PolicyPlugin }, logger?: Logger) {
        this.logger = logger ?? getLogger()

    }

    async executePolicies(store: Store): Promise<IPolicyExecution[]> {
        // this method  is a rewrite without ordering of https://github.com/eyereasoner/Koreografeye/blob/3c47764951f20360125a36536c17c7bf28560c98/src/policy/Executor.ts#L39-L86
        const policies = await extractPolicies(store, "none", {}, this.logger);

        const executions: IPolicyExecution[] = []

        for (const policy of Object.values(policies)) {
            const implementation = this.plugins[policy.target]
            const policyStore = extractGraph(store, policy.node)
            let result
            try {
                // callImplementation, but this time with a result
                result = await implementation.execute(store, policyStore, policy);
            } catch (e) {
                console.log(policy.target, "could not be executed.", e);

            }
            executions.push({ policy, result })
        }
        return executions
    }

}