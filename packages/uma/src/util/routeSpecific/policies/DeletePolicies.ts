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
 *  TODO: documentation
 * @param request 
 * @param store 
 * @param storage 
 * @param clientId 
 * @param baseUrl 
 * @returns 
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

    // 2. If the policy contains only rules assigned by the client, we can remove the entire policy
    // Otherwise, we only remove the rules within our reach
    const idsToDelete = otherRules.length === 0 ? [policyId] : ownedRules;

    // 3. Remove the specified quads
    try {
        await Promise.all(idsToDelete.map(id => storage.deleteRule(id)));

    } catch (error) {
        throw new InternalServerError(`Failed to delete rules: ${error}`);
    }

    // Delete succesful
    return {
        status: 200
    }
}