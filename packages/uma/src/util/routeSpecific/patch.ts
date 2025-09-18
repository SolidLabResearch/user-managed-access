import { v4 as uuid } from 'uuid';
import { Store } from "n3";
import {queryEngine} from './index';

/**
 * Update a policy in the store, provided that the client is its assigner.
 *
 * This function checks whether the given client is recorded as assigner
 * before applying the provided update. If the client is not the assigner,
 * the function simply returns without applying changes.
 *
 * @param store the store to update
 * @param _policyID identifier of the policy entity (unused here)
 * @param resourceOwner identifier of the client attempting the update
 * @param query update to apply if the client is the assigner
 */
export const patchPolicy = async (
    store: Store,
    _policyID: string,
    resourceOwner: string,
    query: string
) => {
    // check ownership of resource -- is client assigner?
    const isOwner = store.countQuads(null, "http://www.w3.org/ns/odrl/2/assigner", resourceOwner, null) !== 0;
    if (!isOwner) throw new PatchError(403, "resource owner doesn't match") ; // ? shouldn't this throw an error -- drawback would be information leakage
    else await queryEngine.queryVoid(query.toString(), { sources: [store] });
}

// ! link between target and resource owner is not always included through a policy
// ! there should be some endpoint or link in the store that allows for this discovery
// ! currently, this patch will not work!
/**
 * Construct an update for modifying the status of a request.
 *
 * The update replaces the request’s status with a new one,
 * provided the client is the assigner of a policy targeting
 * the requested resource.
 *
 * @param requestID identifier of the request
 * @param resourceOwner identifier of the client attempting the patch
 * @param patchInformation new status value ("accepted", "denied")
 * @returns a query string
 */
const buildAccessRequestModificationQuery = (requestID: string, resourceOwner: string, patchInformation: string) => `
    PREFIX ex: <http://example.org/> 
    PREFIX sotw: <https://w3id.org/force/sotw#>
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

    DELETE {
        <${requestID}> ex:requestStatus ex:requested .
    } INSERT {
        <${requestID}> ex:requestStatus ex:${patchInformation} .
    } WHERE {
        <${requestID}> a sotw:EvaluationRequest ;
             sotw:requestedTarget ?target .
        ?pol odrl:permission ?perm .
        ?perm odrl:target ?target ;
             odrl:assigner <${resourceOwner}> .
    }
`;

// ! doesn't check if there is already an existing policy between these entities for the same resource
// TODO: include that check
/**
 * Construct an insertion that creates a new policy
 * based on an accepted request.
 *
 * A new policy and permission are inserted into the store,
 * linking the requesting party with the requested target and action.
 *
 * @param requestID identifier of the request
 * @param policy identifier for the new policy
 * @param permission identifier for the new permission
 * @param resourceOwner identifier of the client granting the policy
 * @returns a query string
 */
const buildPolicyCreationFromAccessRequestQuery = (
    requestID: string,
    policy: string,
    permission: string,
    resourceOwner: string,
) => `
    PREFIX ex: <http://example.org/>
    PREFIX sotw: <https://w3id.org/force/sotw#>
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

    INSERT {
        ex:${policy} a odrl:Agreement ;
                    odrl:uid ex:${policy} ;
                    odrl:permission ex:${permission} .
        ex:${permission} a odrl:Permission ;
                        odrl:action ?action ;
                        odrl:target ?target ;
                        odrl:assignee ?requestingParty ;
                        odrl:assigner <${resourceOwner}> .
    } WHERE {
        <${requestID}> a sotw:EvaluationRequest ;
             sotw:requestingParty ?requestingParty ;
             sotw:requestedTarget ?target ;
             sotw:requestedAction ?action ;
             ex:requestStatus ex:accepted .
    }
`;

/**
 * Update the status of a request in the store, and optionally
 * create a new policy if the request is accepted.
 *
 * Only "accepted" and "denied" statuses are allowed.
 * If "accepted", a new policy and permission are inserted
 * linking the client to the requested target and action.
 *
 * @param store the store to update
 * @param accessRequestID identifier of the request
 * @param resourceOwner identifier of the client performing the update
 * @param patchInformation new status ("accepted" or "denied")
 */
export const patchAccessRequest = async (
    store: Store,
    accessRequestID: string,
    resourceOwner: string,
    patchInformation: string
) => {
    if (!['accepted', 'denied'].includes(patchInformation)) return ; // ? perhaps throw an error?
    const patchQuery = buildAccessRequestModificationQuery(accessRequestID, resourceOwner, patchInformation);
    await queryEngine.queryVoid(patchQuery, { sources: [store] });

    if (patchInformation === 'accepted') {
        const newPolicyQuery = buildPolicyCreationFromAccessRequestQuery(accessRequestID, uuid(), uuid(), resourceOwner);
        await queryEngine.queryVoid(newPolicyQuery, { sources: [store] });
    }
}

export class PatchError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
    }
}
