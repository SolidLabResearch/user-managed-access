import { UCRulesStorage } from "@solidlab/ucp";
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
            "Already existing policies found",
            postPolicy,
            deletePolicy,
            getPolicies,
            getPolicy,
            patchPolicy,
        );
    }
}
