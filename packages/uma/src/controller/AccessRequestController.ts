import { UCRulesStorage } from "@solidlab/ucp";
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
}
