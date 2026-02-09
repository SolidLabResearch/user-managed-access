import { Quad } from '@rdfjs/types';
import { DataFactory as DF, Quad_Subject, Store } from 'n3';
import { ODRL } from 'odrl-evaluator';
import {queryEngine} from './index';

/**
 * Run a query against a store and collect the matching subgraphs.
 *
 * For each set of variable bindings, this function extracts all triples
 * where the bound terms appear as subjects, then groups them into a result store.
 *
 * @param store the source store to query
 * @param query the query string to execute
 * @param vars list of variable names that must be present in the result
 * @returns a store containing the merged results of all matching subgraphs
 */
const executeGet = async (
    store: Store,
    query: string,
    vars: string[]
): Promise<Store> => {
    const result = new Store();

    const bindings = await queryEngine.queryBindings(query, { sources: [store] });
    const results: Store[] = [];

    bindings.on('data', (binding) => {
        const subStore = new Store();
        let valid = true;

        for (const v of vars) {
            const term = binding.get(v);

            if (!term) {
                valid = false;
                break;
            }

            subStore.addQuads(permissionToQuads(store, term));
        }

        if (valid) results.push(subStore)
    });

    return new Promise<Store>((resolve, _rejects) => {
        bindings.on('end', () => {
            results.forEach((resultStore) => result.addAll(resultStore));
            resolve(result);
        });
    });
}

/**
 * Build a query to retrieve a single policy and its permissions
 * by matching both the policy ID and the client’s role as assigner.
 *
 * @param policyID identifier of the policy
 * @param resourceOwner identifier of the assigner
 * @returns a query string
 */
const buildPolicyRetrievalQuery = (policyID: string, resourceOwner: string) => `
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>
    
    SELECT DISTINCT ?policy ?perm
    WHERE {
        ?policy odrl:uid <${policyID}> ;
                odrl:permission ?perm .
        ?perm odrl:assigner <${resourceOwner}> .

        {
            ?policy a odrl:Agreement .
        } UNION {
            ?policy a odrl:Set .
        }
    }
`;


/**
 * Retrieve a single policy and its permissions.
 *
 * @param store the source store
 * @param policyID identifier of the policy
 * @param resourceOwner identifier of the client (assigner or assignee)
 * @returns a store containing the policy and its permissions
 */
export const getPolicy = (store: Store, policyID: string, resourceOwner: string) =>
    executeGet(store, buildPolicyRetrievalQuery(policyID, resourceOwner), ['policy', 'perm']);

/**
 * Build a query to retrieve all policies for a given client.
 * A client may act as assigner or assignee.
 *
 * @param resourceOwner identifier of the client
 * @returns a query string
 */
const buildPoliciesRetrievalQuery = (resourceOwner: string) => `
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>
    
    SELECT DISTINCT ?policy ?perm
    WHERE {
        ?policy odrl:permission ?perm .
        ?perm odrl:assigner <${resourceOwner}> .

        {
            ?policy a odrl:Agreement .
        } UNION {
            ?policy a odrl:Set .
        }
    }
`;

/**
 * Retrieve all policies for a given client.
 *
 * @param store the source store
 * @param resourceOwner identifier of the client
 * @returns a store containing all policies and their permissions
 */
export const getPolicies = (store: Store, resourceOwner: string) =>
    executeGet(store, buildPoliciesRetrievalQuery(resourceOwner), ['perm']);

// TODO: slight improvement over existing solution so constraints get returned but definitely not ideal yet
function permissionToQuads(store: Store, permission: Quad_Subject): Quad[] {
    const result: Quad[] = [];
    const policies = store.getSubjects(ODRL.terms.permission, permission, null);
    for (const policy of policies) {
        result.push(...store.getQuads(policy, null, null, null));
    }
    result.push(...store.getQuads(permission, null, null, null));

    // Constraints
    result.push(
      ...store.getObjects(permission, ODRL.terms.constraint, null).flatMap((constraint) =>
          store.getQuads(constraint, null, null, null)));

    return result;
}
