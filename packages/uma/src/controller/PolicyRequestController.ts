import { UCRulesStorage } from "@solidlab/ucp";
import { BaseController } from "./BaseController";
import { 
    sanitizeDeletePolicy, 
    sanitizeGetPolicies, 
    sanitizeGetPolicy, 
    sanitizePatchPolicy, 
    sanitizePostPolicy 
} from "../util/routeSpecific/sanitization";

export class PolicyController extends BaseController {
    constructor(
        store: UCRulesStorage
    ) {
        super(
            store,
            "Already existing policies found",
            sanitizePostPolicy,
            sanitizeDeletePolicy,
            sanitizeGetPolicies,
            sanitizeGetPolicy,
            sanitizePatchPolicy
        );
    }
}
