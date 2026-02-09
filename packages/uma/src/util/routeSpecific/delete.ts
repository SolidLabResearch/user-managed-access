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
