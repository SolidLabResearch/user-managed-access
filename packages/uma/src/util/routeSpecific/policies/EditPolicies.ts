import { Quad, Store, Writer } from "n3";
import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { UCRulesStorage } from "@solidlab/ucp";
import { checkBaseURL, parseBufferToString, quadsToText, retrieveID } from "./PolicyUtil";
import { QueryEngine } from '@comunica/query-sparql';
import { BadRequestHttpError, InternalServerError } from "@solid/community-server";
import { getOnePolicyInfo } from "./GetPolicies";

// Apparently js does not have this
const setIsEqual = (xs: Set<Quad>, ys: Set<Quad>) => {
    return xs.size === ys.size &&
        [...xs].every((x) => [...ys].some(y => x.equals(y)))
};

export async function editPolicy(request: HttpHandlerRequest, store: Store, storage: UCRulesStorage, clientId: string, baseUrl: string): Promise<HttpHandlerResponse<any>> {
    // 1. Retrieve Policy ID
    const policyId = decodeURIComponent(retrieveID(checkBaseURL(request, baseUrl)));

    // 2. Retrieve the Policy Body
    const contentType = request.headers['content-type'];
    if (!/(?:application\/sparql-update)$/i.test(contentType)) {
        throw new BadRequestHttpError(`Content-Type ${contentType} is not supported.`);
    }
    const query = parseBufferToString(request.body);

    // 3. Retrieve the existing policy info
    const { policyQuads, ownedRules, otherRules } = getOnePolicyInfo(policyId, store, clientId);

    // 4. Execute the query on the policy
    const policyStore = new Store([...policyQuads, ...ownedRules, ...otherRules]);
    const writer = new Writer('Turtle');
    const initialQuads = policyStore.getQuads(null, null, null, null);
    try {
        await new QueryEngine().queryVoid(query, { sources: [policyStore] });
    } catch (error) {
        throw new BadRequestHttpError("Query could not be executed:", error);
    }

    // 5. Simple safety checks
    // Check that the other rules are unchanged

    const newState = getOnePolicyInfo(policyId, policyStore, clientId);
    if (!setIsEqual(newState.otherRules, otherRules))
        throw new BadRequestHttpError("Update not allowed: attempted to modify rules not owned by client");

    // Check that only Policy/Rule changing quads are introduced and removed
    const newQuads = policyStore.getQuads(null, null, null, null);
    if (newQuads.length - newState.ownedRules.size - newState.policyQuads.size !== initialQuads.length - policyQuads.size - ownedRules.size)
        throw new BadRequestHttpError("Update not allowed: this query introduces quads that have nothing to do with the policy/rules you own")

    // 6. Modify the storage to the updated version, there is currently no real modification method.
    try {
        await storage.deleteRule(policyId);
        await storage.addRule(policyStore);
    } catch (error) {
        throw new InternalServerError("Something went wrong while editting the policy:", error);
    }
    return quadsToText(policyStore.getQuads(null, null, null, null));
}