import { Store } from "n3";
import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { UCRulesStorage } from "@solidlab/ucp";
import { checkBaseURL, parsePolicyBody, quadsToText, retrieveID } from "./PolicyUtil";
import { QueryEngine } from '@comunica/query-sparql';
import { BadRequestHttpError } from "@solid/community-server";
import { getOnePolicyInfo } from "./GetPolicies";

export async function editPolicy(request: HttpHandlerRequest, store: Store, clientId: string, baseUrl: string): Promise<HttpHandlerResponse<any>> {
    // 1. Retrieve Policy ID
    const policyId = decodeURIComponent(retrieveID(checkBaseURL(request, baseUrl)));

    // 2. Retrieve the Policy Body
    const contentType = request.headers['content-type'];
    if (!/(?:application\/sparql-update)$/i.test(contentType)) {
        throw new BadRequestHttpError(`Content-Type ${contentType} is not supported.`);
    }
    const query = parsePolicyBody(request.body);

    // 3. Retrieve the existing policy
    const { policyQuads, ownedRules, otherRules } = getOnePolicyInfo(policyId, store, clientId);

    // 4. Execute the query on the policy
    const policyStore = new Store([...policyQuads, ...ownedRules, ...otherRules]);
    const engine = new QueryEngine();
    await engine.queryVoid(query, { sources: [policyStore] });

    // 5. Check if we stayed between our boundaries
    const newState = getOnePolicyInfo(policyId, policyStore, clientId);
    if (newState.otherRules != otherRules) throw new BadRequestHttpError("UPDATE rules within authorization reach");

    return quadsToText([...newState.policyQuads, ...newState.ownedRules, ...newState.otherRules]);
}