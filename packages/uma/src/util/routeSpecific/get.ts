import { Store } from "n3";
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

            subStore.addQuads(store.getQuads(term, null, null, null));
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
    executeGet(store, buildPoliciesRetrievalQuery(resourceOwner), ['policy', 'perm']);

// ! There is not necessarily a link between resource owner and resource through a policy
// ! Currently, only the requests where the client is requesting party will be given,
// ! for requested targets that aren't included in some policy already.

/**
 * Build a query to retrieve a single request,
 * provided that the client is either the requesting party
 * or the assigner of a policy targeting the same resource.
 *
 * @param requestID identifier of the request
 * @param requestingPartyOrResourceOwner identifier of the client
 * @returns a query string
 */
const buildAccessRequestRetrievalQuery = (requestID: string, requestingPartyOrResourceOwner: string) => `
    PREFIX sotw: <https://w3id.org/force/sotw#>
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

    SELECT DISTINCT ?req
    WHERE {
        {
            <${requestID}> sotw:requestingParty <${requestingPartyOrResourceOwner}> .
        } 
        UNION
        {
            <${requestID}> sotw:requestedTarget ?target .
            ?pol a odrl:Agreement ;
                 odrl:permission ?per .
            ?per odrl:target ?target ;
                 odrl:assigner <${requestingPartyOrResourceOwner}> .
        }
    }
`;

/**
 * Retrieve a single request by ID,
 * if the client is the requesting party or assigner of the target.
 *
 * @param store the source store
 * @param accessRequestID identifier of the request
 * @param requestingPartyOrResourceOwner identifier of the client
 * @returns a store containing the request
 */
export const getAccessRequest = (store: Store, accessRequestID: string, requestingPartyOrResourceOwner: string) =>
    executeGet(store, buildAccessRequestRetrievalQuery(accessRequestID, requestingPartyOrResourceOwner), ['req']);

/**
 * Build a query to retrieve all requests for a client,
 * either as requesting party or as assigner of the requested target.
 *
 * @param requestingPartyOrResourceOwner identifier of the client
 * @returns a query string
 */
const buildAccessRequestsRetrievalQuery = (requestingPartyOrResourceOwner: string) => `
    PREFIX sotw: <https://w3id.org/force/sotw#>
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

    SELECT DISTINCT ?req
    WHERE {
        {
            ?req sotw:requestingParty <${requestingPartyOrResourceOwner}> .
        } 
        UNION
        {
            ?req sotw:requestedTarget ?target .
            ?pol a odrl:Agreement ;
                 odrl:permission ?per .
            ?per odrl:target ?target ;
                 odrl:assigner <${requestingPartyOrResourceOwner}> .
        }
    }
`;

/**
 * Retrieve all requests for a client,
 * either as requesting party or as assigner of the requested targets.
 *
 * @param store the source store
 * @param requestingPartyOrResourceOwner identifier of the client
 * @returns a store containing the requests
 */
export const getAccessRequests = (store: Store, requestingPartyOrResourceOwner: string) =>
    executeGet(store, buildAccessRequestsRetrievalQuery(requestingPartyOrResourceOwner), ['req']);
