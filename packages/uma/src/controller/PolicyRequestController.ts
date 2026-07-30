import { Store } from 'n3';
import { UCRulesStorage } from "../ucp/storage/UCRulesStorage";
import { BaseController } from "./BaseController";
import {
    getPolicies,
    getPolicy,
    patchPolicy,
    postPolicy
} from "../util/routeSpecific";

/**
 * Controller for routes concerning policies and related rules
 */
export class PolicyController extends BaseController {
    constructor(
        store: UCRulesStorage
    ) {
        super(
            store,
            postPolicy,
            null as any,
            getPolicies,
            getPolicy,
            patchPolicy,
        );
        this.sanitizeDelete = this.deletePolicy.bind(this);
    }

    // TODO: quick ugly workaround for delete not removing constraints
    protected async deletePolicy(store: Store, policyID: string, resourceOwner: string): Promise<void> {
        const policy = await getPolicy(store, policyID, resourceOwner);
        store.removeQuads([ ...policy ]);
    }
}
