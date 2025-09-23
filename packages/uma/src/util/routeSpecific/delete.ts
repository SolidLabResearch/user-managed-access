import { Store } from "n3"
import {queryEngine} from './index';

/**
 * Executes a DELETE query against the given store.
 * 
 * @param store store containing the data to be modified
 * @param query DELETE query string to be executed
 * @returns a promise resolving when the deletion is completed
 */
const executeDelete = async (
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
 * @param resourceOwner ID of the resource owner (assigner) who owns the policy
 * @returns a DELETE query string
 */
const buildPolicyDeletionQuery = (policyID: string, resourceOwner: string) => `
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

    DELETE {
        ?policy ?policyPredicate ?policyObject .
        ?permission ?permissionPredicate ?permissionObject .
    } WHERE {
        ?policy odrl:permission ?permission ;
                odrl:uid <${policyID}> .
        ?permission odrl:assigner <${resourceOwner}> .

        {
            ?policy a odrl:Agreement .
        } UNION {
            ?policy a odrl:Set .
        }

        ?policy ?policyPredicate ?policyObject .
        ?permission ?permissionPredicate ?permissionObject .
    }
`;

/**
 * Delete a policy (including its associated permissions) from the store.
 * 
 * @param store store containing the policies
 * @param policyID ID of the policy to delete
 * @param resourceOwner ID of the resource owner (assigner) responsible for the policy
 * @returns a promise resolving when deletion is completed
 */
export const deletePolicy = (store: Store, policyID: string, resourceOwner: string) =>
    executeDelete(store, buildPolicyDeletionQuery(policyID, resourceOwner));

/**
 * Build a query that deletes an access request and its related triples.
 * 
 * The deletion is permitted if either:
 * - The request has the given `requestID` and `clientID` is the requesting party, OR
 * - The request targets a resource assigned to `clientID` via an ODRL agreement.
 * 
 * @param requestID ID of the access request to delete
 * @param requestingPartyOrResourceowner ID of the requesting party or resource owner
 * @returns a DELETE query string
 */
const buildAccessRequestDeletionQuery = (requestID: string, requestingPartyOrResourceowner: string) => `
    PREFIX sotw: <https://w3id.org/force/sotw#>
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

    DELETE {
        <${requestID}> ?p ?o
    } WHERE {
        <${requestID}> ?p ?o .
        {
            <${requestID}> sotw:requestingParty <${requestingPartyOrResourceowner}> .
        } 
        UNION
        {
            <${requestID}> sotw:requestedTarget ?target .
            ?pol a odrl:Agreement ;
                 odrl:permission ?per .
            ?per odrl:target ?target ;
                 odrl:assigner <${requestingPartyOrResourceowner}> .
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
 * @param requestingPartyOrResourceOwner ID of the requesting party or resource owner
 * @returns a promise resolving when deletion is completed
 */
export const deleteAccessRequest = (store: Store, requestID: string, requestingPartyOrResourceOwner: string) =>
    executeDelete(store, buildAccessRequestDeletionQuery(requestID, requestingPartyOrResourceOwner));
