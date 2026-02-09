import { UCRulesStorage } from "../ucp/storage/UCRulesStorage";
import { BaseController } from "./BaseController";
import {
    deletePolicy,
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
            deletePolicy,
            getPolicies,
            getPolicy,
            patchPolicy,
        );
    }
}
