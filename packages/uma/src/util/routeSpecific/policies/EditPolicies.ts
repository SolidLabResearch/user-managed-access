import { Store } from "n3";
import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { UCRulesStorage } from "@solidlab/ucp";
import { checkBaseURL, parsePolicyBody, quadsToText, retrieveID } from "./PolicyUtil";
import { QueryEngine } from '@comunica/query-sparql';
import { BadRequestHttpError, InternalServerError } from "@solid/community-server";
import { getOnePolicyInfo } from "./GetPolicies";

// Apparently js does not have this
const setIsEqual = (xs: Set<any>, ys: Set<any>) =>
    xs.size === ys.size &&
    [...xs].every((x) => ys.has(x))

export async function editPolicy(request: HttpHandlerRequest, store: Store, storage: UCRulesStorage, clientId: string, baseUrl: string): Promise<HttpHandlerResponse<any>> {
    // 1. Retrieve Policy ID
    const policyId = decodeURIComponent(retrieveID(checkBaseURL(request, baseUrl)));

    // 2. Retrieve the Policy Body
    const contentType = request.headers['content-type'];
    if (!/(?:application\/sparql-update)$/i.test(contentType)) {
        throw new BadRequestHttpError(`Content-Type ${contentType} is not supported.`);
    }
    const query = parsePolicyBody(request.body);

    // 3. Retrieve the existing policy info
    const { policyQuads, ownedRules, otherRules } = getOnePolicyInfo(policyId, store, clientId);

    // 4. Execute the query on the policy
    const policyStore = new Store([...policyQuads, ...ownedRules, ...otherRules]);
    try {
        await new QueryEngine().queryVoid(query, { sources: [policyStore] });
    } catch (error) {
        throw new BadRequestHttpError("Query could not be executed:", error);
    }

    // 5. Check if we stayed between our boundaries
    const newState = getOnePolicyInfo(policyId, policyStore, clientId);
    if (!setIsEqual(newState.otherRules, otherRules)) throw new BadRequestHttpError("Update not allowed: attempted to modify rules not owned by client");

    // 6. Modify the storage to the updated version
    try {
        await storage.deleteRule(policyId);
        await storage.addRule(policyStore);
    } catch (error) {
        throw new InternalServerError("Something went wrong while editting the policy:", error);
    }
    return quadsToText(policyStore.getQuads(null, null, null, null));
}