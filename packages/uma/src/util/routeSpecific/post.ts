import { Store, DataFactory } from "n3";
import { ODRL } from 'odrl-evaluator';
import {queryEngine} from './index';
import { BadRequestHttpError, ForbiddenHttpError, RDF, XSD } from "@solid/community-server";
const {literal, namedNode} = DataFactory
/**
 * Run a query against the store and extract exactly one matching subgraph.
 *
 * For each result binding, a sub-store is created containing all triples
 * where the bound terms appear as subjects.
 *
 * @param store the source store to query
 * @param query the query string to execute
 * @param vars list of variables that must be present in the result
 * @returns a store containing exactly one matching subgraph
 */
const executePost = async (
    store: Store,
    query: string,
    vars: string[]
): Promise<Store> => {
    const bindings = await queryEngine.queryBindings(query, { sources: [store] });
    const results: Store[] = [];

    bindings.on('data', (binding) => {
        const subsStore = new Store();
        let valid = true;

        for (const v of vars) {
            const term = binding.get(v);

            if (!term) {
                valid = false;
                break;
            }

            subsStore.addQuads(store.getQuads(term, null, null, null));
        }

        if (valid) results.push(subsStore);
    });

    return new Promise<Store>((resolve, rejects) => {
        bindings.on('end', () => {
            const result: Store = new Store();
            results.forEach((store) => result.addAll(store));
            if (results.length === 0) rejects('failed to create');
            else resolve(store);
        });
    });
};

/**
 * Build a query to retrieve a newly posted policy,
 * ensuring that the client is the assigner of its permission.
 *
 * @param resourceOwner identifier of the client
 * @returns a query string
 */
const buildPolicyCreationQuery = (resourceOwner: string) => `
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

    SELECT DISTINCT ?p ?r ?target
    WHERE {
        {
            ?p a odrl:Agreement ;
               odrl:permission ?r ;
               odrl:uid ?p .
            ?r odrl:assignee ?assignee .
        } UNION {
            ?p a odrl:Set ;
               odrl:permission ?r ;
               odrl:uid ?p .
        }

        ?r a odrl:Permission ;
           odrl:action ?action ;
           odrl:target ?target ;
           odrl:assigner <${resourceOwner}> .
    }
`;

/**
 * Validate and retrieve a newly posted policy.
 *
 * Requires that the policy has exactly one matching definition
 * and that the client is the assigner of its permission.
 *
 * @param store the source store
 * @param resourceOwner identifier of the client (assigner)
 * @returns the validated policy as a store
 */
export const postPolicy = async (store: Store, resourceOwner: string):
    Promise<{ result: Store, id: string }> => {
    const isOwner = store.countQuads(null, 'http://www.w3.org/ns/odrl/2/assigner', resourceOwner, null) !== 0;
    if (!isOwner) throw new ForbiddenHttpError();

    const result = await executePost(store, buildPolicyCreationQuery(resourceOwner), ["p", "r"]);

    // TODO: at least currently it is allowed to add multiple policies in a single POST so we can't really return an ID
    return { result, id: '' };
}
