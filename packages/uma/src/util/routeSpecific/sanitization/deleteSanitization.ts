import { Store } from "n3"
import { queryEngine } from ".";

/**
 * Executes a DELETE query against the given store.
 * 
 * @param store store containing the data to be modified
 * @param query DELETE query string to be executed
 * @returns a promise resolving when the deletion is completed
 */
const sanitizeDelete = async (
    store: Store,
    query: string,
): Promise<void> => {
    await queryEngine.queryVoid(query, { sources: [ store ] });
}

/**
 * Build a query that deletes a policy and its associated permissions.
 * 
 * The deletion only occurs if the policy has the given `policyID` and is assigned
 * to the provided `clientID`.
 * 
 * @param policyID ID of the policy to delete
 * @param clientID ID of the resource owner (assigner) who owns the policy
 * @returns a DELETE query string
 */
const deletePolicyQuery = (policyID: string, clientID: string) => `
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

    DELETE {
        ?policy ?policyPredicate ?policyObject .
        ?permission ?permissionPredicate ?permissionObject .
    } WHERE {
        ?policy a odrl:Agreement ;
                odrl:permission ?permission ;
                odrl:uid <${policyID}> .
        ?permission odrl:assigner <${clientID}> .

        ?policy ?policyPredicate ?policyObject .
        ?permission ?permissionPredicate ?permissionObject .
    }
`;

/**
 * Delete a policy (including its associated permissions) from the store.
 * 
 * @param store store containing the policies
 * @param policyID ID of the policy to delete
 * @param clientID ID of the resource owner (assigner) responsible for the policy
 * @returns a promise resolving when deletion is completed
 */
export const sanitizeDeletePolicy = (store: Store, policyID: string, clientID: string) =>
    sanitizeDelete(store, deletePolicyQuery(policyID, clientID));

/**
 * Build a query that deletes an access request and its related triples.
 * 
 * The deletion is permitted if either:
 * - The request has the given `requestID` and `clientID` is the requesting party, OR
 * - The request targets a resource assigned to `clientID` via an ODRL agreement.
 * 
 * @param requestID ID of the access request to delete
 * @param clientID ID of the requesting party or resource owner
 * @returns a DELETE query string
 */
const deleteRequestQuery = (requestID: string, clientID: string) => `
    PREFIX sotw: <https://w3id.org/force/sotw#>
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

    DELETE {
        ?req ?p ?o
    } WHERE {
        ?req odrl:uid <${requestID}> ;
             ?p ?o .
        {
            ?req sotw:requestingParty <${clientID}> .
        } 
        UNION
        {
            ?req sotw:requestedTarget ?target .
            ?pol a odrl:Agreement ;
                 odrl:permission ?per .
            ?per odrl:target ?target ;
                 odrl:assigner <${clientID}> .
        }
    }
`;

/**
 * Delete an access request (including all its triples) from the store.
 * 
 * Deletion is allowed if:
 * - The given `clientID` is the requesting party, OR
 * - The `clientID` is the assigner of a policy targeting the same resource as the request.
 * 
 * @param store store containing the requests
 * @param requestID ID of the request to delete
 * @param clientID ID of the requesting party or resource owner
 * @returns a promise resolving when deletion is completed
 */
export const sanitizeDeleteRequest = (store: Store, requestID: string, clientID: string) =>
    sanitizeDelete(store, deleteRequestQuery(requestID, clientID));
