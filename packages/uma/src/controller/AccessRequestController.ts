import { UCRulesStorage } from "../ucp/storage/UCRulesStorage";
import { BaseController } from "./BaseController";
import {
    deleteAccessRequest,
    getAccessRequest,
    getAccessRequests,
    patchAccessRequest,
    postAccessRequest
} from "../util/routeSpecific";

/**
 * Controller for routes concerning access requests
 */
export class AccessRequestController extends BaseController {
    constructor(
        store: UCRulesStorage,
    ) {
        super(
            store,
            'Already existing requests found',
            postAccessRequest,
            deleteAccessRequest,
            getAccessRequests,
            getAccessRequest,
            patchAccessRequest,
        );
    }

    /**
     * Deletes are not allowed on access requests.
     *
     * @param entityID ID pointing to the policy or access request
     * @param clientID ID of the resource owner (RO) or requesting party (RP) making the deletion
     * @returns a status code: 403
     */
    public async deleteEntity(entityID: string, clientID: string): Promise<{ status: number }> {
        return { status: 403 };
    }

    public async putEntity(data: string, entityID: string, clientID: string): Promise<{ status: number }> {
        return { status: 403 };
    }

}
