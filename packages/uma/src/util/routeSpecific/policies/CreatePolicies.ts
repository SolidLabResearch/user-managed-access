import { Store } from "n3";
import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { odrlAssigner, parseBodyToStore, relations } from "./PolicyUtil";
import { BadRequestHttpError, InternalServerError } from "@solid/community-server";
import { UCRulesStorage } from "@solidlab/ucp";

export function sanitizeRule(parsedPolicy: Store, clientId: string): void {
    // Check that every rule defined by the policy has exactly one assigner, every rule is unique and every assigner is the client
    const definedRules = new Set();
    for (const relation of relations) {

        // Every rule definition of every policy
        const policyRelationRules = parsedPolicy.getQuads(null, relation, null, null);

        for (const quad of policyRelationRules) {
            const rule = quad.object;

            // The policy should not define multiple rules with the same ID, this check also 
            // restricts the same rule to be defined twice (even if relation is equal)
            if (definedRules.has(rule)) throw new BadRequestHttpError(`Rule ambiguity in rule ${rule.id}`);
            definedRules.add(rule);

            // The rule should have exactly one assigner, and it should be the client
            const ruleAssignerX = parsedPolicy.getQuads(rule, odrlAssigner, null, null);

            if (ruleAssignerX.length !== 1) throw new BadRequestHttpError(`Rule ${rule.id} should have exactly one assigner`);
            if (ruleAssignerX[0].object.id !== clientId) throw new BadRequestHttpError(`Rule ${rule.id} needs an authorized assigner`);
        }
    }

    // Check if assigner of the policy has access to the target
    // Check if there is at least one permission/prohibition/duty
    // Check if every rule has a target
    // ...
}

export async function addPolicies(request: HttpHandlerRequest, storage: UCRulesStorage, clientId: string): Promise<HttpHandlerResponse<any>> {

    // 1. Parse the requested policy
    const parsedPolicy = await parseBodyToStore(request);

    // 2. Sanitization checks (error is thrown when checks fail)
    sanitizeRule(parsedPolicy, clientId);


    // 3 Add the policy to the rule storage
    try {
        await storage.addRule(parsedPolicy);
    } catch (error) {
        throw new InternalServerError("Failed to add policy");
    }


    return {
        status: 201
    }
}