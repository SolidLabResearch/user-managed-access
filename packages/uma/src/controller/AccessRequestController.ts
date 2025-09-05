import { UCRulesStorage } from "@solidlab/ucp";
import { BaseController } from "./BaseController";
import { 
    sanitizeDeleteRequest, 
    sanitizeGetRequest, 
    sanitizeGetRequests, 
    sanitizePatchRequest, 
    sanitizePostRequest 
} from "../util/routeSpecific/sanitization";

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
            sanitizePostRequest,
            sanitizeDeleteRequest,
            sanitizeGetRequests,
            sanitizeGetRequest,
            sanitizePatchRequest
        );
    }
}
