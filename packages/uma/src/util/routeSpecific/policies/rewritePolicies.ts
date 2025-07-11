import { UCRulesStorage } from "@solidlab/ucp";
import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { BadRequestHttpError, InternalServerError } from "@solid/community-server";
import { checkBaseURL, parseBodyToStore, quadsToText, relations, retrieveID } from "./PolicyUtil";
import { Quad, Store } from "n3";
import { sanitizeRule } from "./CreatePolicies";
import { deleteOnePolicy } from "./DeletePolicies";
import { getPolicyInfo } from "./GetPolicies";

export async function rewritePolicy(request: HttpHandlerRequest, store: Store, storage: UCRulesStorage, clientId: string, baseUrl: string): Promise<HttpHandlerResponse<any>> {
    // Retrieve Policy ID
    const policyId = decodeURIComponent(retrieveID(checkBaseURL(request, baseUrl)));

    // 1: Get all reachable policy information
    const policyInfo = getPolicyInfo(policyId, store, clientId);
    if (policyInfo.policyDefinitions.length === 0)
        throw new BadRequestHttpError("Patch not allowed: policy does not exist");


    // 2. Parse the requested policy, perform checks
    const parsedPolicy = await parseBodyToStore(request);

    // Sanitization checks (error is thrown when checks fail)
    sanitizeRule(parsedPolicy, clientId);

    // Extra checks: this newly defined policy should not define other policies
    if (relations.some(relation => parsedPolicy.getQuads(null, relation, null, null).some(quad => quad.subject.id !== policyId)))
        throw new BadRequestHttpError("PUT not allowed: the request went out of scope");

    // Extra checks: new policy should not contain out of scope rules
    const newState = getPolicyInfo(policyId, parsedPolicy, clientId);
    if (newState.otherRules.length !== 0 || newState.otherPolicyRules.length !== 0)
        throw new BadRequestHttpError("PUT not allowed: attempted to modify rules not owned by client");

    // Extra checks: only Policy/Rule changing quads are introduced and removed
    // The only modifications we allow are policy definitions, policy rules that define owned rules and owned rules themselves
    const newQuads = parsedPolicy.getQuads(null, null, null, null);
    if (newQuads.length - newState.ownedRules.length - newState.ownedPolicyRules.length - newState.policyDefinitions.length !== 0)
        throw new BadRequestHttpError("PUT not allowed: this query introduces quads that have nothing to do with the policy/rules you own");


    // 3. Delete the old policy information and keep track of the old ones for possible rollback
    const oldQuads: Quad[] = [...policyInfo.policyDefinitions, ...policyInfo.ownedPolicyRules, ...policyInfo.otherPolicyRules, ...policyInfo.ownedRules, ...policyInfo.otherRules];

    await deleteOnePolicy(policyId, store, storage, clientId);

    try {
        // 4. Add the new policy information
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

    // Delete only what is in your reach
    const { policyDefinitions, ownedPolicyRules, ownedRules } = getPolicyInfo(policyId, parsedPolicy, clientId);
    return quadsToText([...policyDefinitions, ...ownedPolicyRules, ...ownedRules]);
}