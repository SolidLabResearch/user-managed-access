import { UCRulesStorage } from "@solidlab/ucp";
import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { BadRequestHttpError, InternalServerError } from "@solid/community-server";
import { checkBaseURL, parseBodyToStore, quadsToText, retrieveID } from "./PolicyUtil";
import { Quad, Store } from "n3";
import { sanitizeRule } from "./CreatePolicies";
import { deleteOnePolicy } from "./DeletePolicies";
import { getOnePolicyInfo } from "./GetPolicies";

export async function rewritePolicy(request: HttpHandlerRequest, store: Store, storage: UCRulesStorage, clientId: string, baseUrl: string): Promise<HttpHandlerResponse<any>> {
    // 1. Retrieve Policy ID
    const policyId = decodeURIComponent(retrieveID(checkBaseURL(request, baseUrl)));

    // 2: Get all reachable policy information
    const { policyDefinitions, ownedPolicyRules, otherPolicyRules, ownedRules, otherRules } = getOnePolicyInfo(policyId, store, clientId);
    if (policyDefinitions.length === 0)
        throw new BadRequestHttpError("You cannot PATCH a nonexistent policy");

    // 3. Parse the requested policy
    const parsedPolicy = await parseBodyToStore(request);

    // 4. Sanitization checks (error is thrown when checks fail)
    sanitizeRule(parsedPolicy, clientId);

    // 5. Delete the old policy information and keep track of the old ones for possible rollback
    const oldQuads: Quad[] = [...policyDefinitions, ...ownedPolicyRules, ...otherPolicyRules, ...ownedRules, ...otherRules];
    await deleteOnePolicy(policyId, store, storage, clientId);

    try {
        // 6. Add the new policy information
        await storage.addRule(parsedPolicy);
    } catch (error) {
        // If addition fails, try to restore the old quads
        try {
            await storage.addRule(new Store(oldQuads));
        } catch (error) {
            // The restored quads could also not be added, the patch failed and the old policy (whithin your reach) is deleted
            throw new InternalServerError("Deleted, but not rewritten\n", error);
        }
        // The restored quads have been added, the patch failed and nothing changed
        throw new InternalServerError("Failed to PATCH policy\n", error);
    }

    return quadsToText(parsedPolicy.getQuads(null, null, null, null));
}