import { UCRulesStorage } from "@solidlab/ucp";
import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { checkBaseURL, namedNode, odrlAssigner, quadsToText, relations, retrieveID } from "./PolicyUtil";
import { Quad, Store } from "n3";
import { InternalServerError } from "@solid/community-server";

export async function deletePolicy(request: HttpHandlerRequest, store: Store, storage: UCRulesStorage, clientId: string, baseUrl: string): Promise<HttpHandlerResponse<any>> {

    const policyId = decodeURIComponent(retrieveID(checkBaseURL(request, baseUrl)));
    return deleteOnePolicy(policyId, store, storage, clientId)
}


/**
 * To delete a policy, send a DELETE request to `/uma/policies/<policyId>` with the URL encoded ID of the policy. The DELETE works like this:
 *  1. Find the rules defined in the policy
 *  2. Filter the rules that are assigned by the client, and delete them
 *  3. Find out if there are rules not assigned by the client
 * if there are other rules, we cannot delete the policy information as well
 * if there are no other rules, we can delete the entire policy
 * 
 * As read in /docs/policy-managament.md
 */
export async function deleteOnePolicy(policyId: string, store: Store, storage: UCRulesStorage, clientId: string): Promise<HttpHandlerResponse<any>> {

    // 1. Collect the IDs of the rules we want to delete
    const policyRules: Quad[] = relations.flatMap(relation =>
        store.getQuads(namedNode(policyId), relation, null, null)
    )

    // Keep track of IDs that are (not) within the clients reach
    const otherRules: string[] = [];
    const ownedRules: string[] = [];
    policyRules.forEach(quad => {
        if (store.getQuads(quad.object, odrlAssigner, namedNode(clientId), null).length === 1)
            ownedRules.push(quad.object.id);
        else
            otherRules.push(quad.object.id);
    });

    // Nothing to delete
    if (ownedRules.length === 0) {
        return {
            status: 204,
        };
    }

    // DELETE the quads
    try {
        if (otherRules.length === 0) {
            // If the policy contains only rules assigned by the client, we can remove the entire policy
            await storage.deleteRule(policyId);
        } else {
            // Otherwise, we only remove the rules within our reach
            await Promise.all(ownedRules.map(id => storage.deleteRuleFromPolicy(id, policyId)));
        }

    } catch (error) {
        throw new InternalServerError(`Failed to delete rules: ${error}`);
    }

    // Delete succesful
    return {
        status: 200
    }
}