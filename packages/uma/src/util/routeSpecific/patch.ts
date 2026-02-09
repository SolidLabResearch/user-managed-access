import { ForbiddenHttpError } from '@solid/community-server';
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
    if (!isOwner) {
        throw new ForbiddenHttpError("resource owner doesn't match") ;
    }
    else await queryEngine.queryVoid(query.toString(), { sources: [store] });
}
