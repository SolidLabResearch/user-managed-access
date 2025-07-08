import { UCRulesStorage } from "@solidlab/ucp";
import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { checkBaseURL, namedNode, odrlAssigner, quadsToText, relations, retrieveID } from "./PolicyUtil";
import { Quad, Store } from "n3";
import { InternalServerError } from "@solid/community-server";

/**
 *  TODO: documentation
 * @param request 
 * @param store 
 * @param storage 
 * @param clientId 
 * @param baseUrl 
 * @returns 
 */
export async function deletePolicies(request: HttpHandlerRequest, store: Store, storage: UCRulesStorage, clientId: string, baseUrl: string): Promise<HttpHandlerResponse<any>> {
    // 1. Retrieve Policy ID
    const policyId = decodeURIComponent(retrieveID(checkBaseURL(request, baseUrl)));

    // 2. Collect the IDs of the rules we want to delete
    let policyRules: Quad[] = []
    for (const relation of relations) {
        policyRules = [...policyRules, ...store.getQuads(namedNode(policyId), relation, null, null)]
    }

    // Nothing to delete
    // TODO: change status code, nothing to delete
    if (policyRules.length === 0) {
        return {
            status: 200,
        };
    }

    // Keep track of IDs that are not within the clients reach
    const otherRules: string[] = [];
    const ownedRules: string[] = [];
    policyRules.forEach(quad => {
        if (store.getQuads(quad.object, odrlAssigner, namedNode(clientId), null).length > 0)
            ownedRules.push(quad.object.id);
        else
            otherRules.push(quad.object.id);
    });

    // 3. If the policy has rules that do not belong to the client, we cannot remove the policy quads
    const rulesToDelete = otherRules.length === 0 ? ownedRules : ownedRules.concat(store.getQuads(namedNode(policyId), null, null, null).map(quad => quad.subject.id));

    // 4. Remove the specified quads
    try {
        rulesToDelete.forEach(id => storage.deleteRule(id));
    } catch (error) {
        throw new InternalServerError("Failed to delete rules");
    }

    // Delete succesful
    return {
        status: 200
    }
}