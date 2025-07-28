import { Store } from "n3";
import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { UCRulesStorage } from "@solidlab/ucp";
import { checkBaseURL, parseBufferToString, quadsToText, retrieveID } from "./PolicyUtil";
import { QueryEngine } from '@comunica/query-sparql';
import { BadRequestHttpError, InternalServerError } from "@solid/community-server";
import { getPolicyInfo } from "./GetPolicies";
import { sanitizeRule } from "./CreatePolicies";

export async function editPolicy(request: HttpHandlerRequest, store: Store, storage: UCRulesStorage, clientId: string, baseUrl: string): Promise<HttpHandlerResponse<any>> {
    // Retrieve Policy ID
    const policyId = decodeURIComponent(retrieveID(checkBaseURL(request, baseUrl)));

    // 1. Retrieve the existing policy info
    const { policyDefinitions, ownedPolicyRules, otherPolicyRules, ownedRules, otherRules } = getPolicyInfo(policyId, store, clientId);

    // Cannot update a nonexistent policy
    if (policyDefinitions.length === 0)
        throw new BadRequestHttpError("Update not allowed: You cannot update a nonexistent policy");

    // Implementation Choice: You cannot PATCH a policy that you are not affiliated with
    if (ownedRules.length === 0)
        throw new BadRequestHttpError("Update not allowed: You cannot update policies that you are not affiliated with");

    // 2. Retrieve the Policy Body
    const contentType = request.headers['content-type'];
    if (!/(?:application\/sparql-update)$/i.test(contentType)) {
        throw new BadRequestHttpError(`Content-Type ${contentType} is not supported.`);
    }
    const query = parseBufferToString(request.body);

    console.log(`
        POLICY INFORMATION
        ${ownedPolicyRules}
        ${ownedRules}
        ${policyDefinitions}

        QUERY: 
        ${query}
    `)



    // 3. Execute the query on the part of the policy that lays within reach
    const policyStore = new Store([...policyDefinitions, ...ownedPolicyRules, ...ownedRules]);
    const initialQuads = policyStore.getQuads(null, null, null, null);
    try {
        await new QueryEngine().queryVoid(query, { sources: [policyStore] });
    } catch (error) {
        throw new BadRequestHttpError("Query could not be executed:", error);
    }

    // Sanitization
    sanitizeRule(policyStore, clientId);

    // 3.1 Check that the other rules are unchanged
    const initialState = { policyDefinitions, ownedPolicyRules, otherPolicyRules, ownedRules, otherRules };
    const newState = getPolicyInfo(policyId, policyStore, clientId);

    console.log(`\n--- POLICY STATE CHANGE ---\nInitial State:\n  policyDefinitions: ${initialState.policyDefinitions.map(q => q.toString()).join("\n    ")}\n  ownedPolicyRules: ${initialState.ownedPolicyRules.map(q => q.toString()).join("\n    ")}\n  otherPolicyRules: ${initialState.otherPolicyRules.map(q => q.toString()).join("\n    ")}\n  ownedRules: ${initialState.ownedRules.map(q => q.toString()).join("\n    ")}\n  otherRules: ${initialState.otherRules.map(q => q.toString()).join("\n    ")}\nNew State:\n  policyDefinitions: ${newState.policyDefinitions.map(q => q.toString()).join("\n    ")}\n  ownedPolicyRules: ${newState.ownedPolicyRules.map(q => q.toString()).join("\n    ")}\n  otherPolicyRules: ${newState.otherPolicyRules.map(q => q.toString()).join("\n    ")}\n  ownedRules: ${newState.ownedRules.map(q => q.toString()).join("\n    ")}\n  otherRules: ${newState.otherRules.map(q => q.toString()).join("\n    ")}\n`);

    if (newState.otherRules.length !== 0 || newState.otherPolicyRules.length !== 0)
        throw new BadRequestHttpError("Update not allowed: attempted to modify rules not owned by client");

    // 3.2 Check that only Policy/Rule changing quads are introduced and removed
    // The only modifications we allow are policy definitions, policy rules that define owned rules and owned rules themselves
    // const newQuads = policyStore.getQuads(null, null, null, null);
    // if (newQuads.length - newState.ownedRules.length - newState.ownedPolicyRules.length - newState.policyDefinitions.length
    //     !== initialQuads.length - ownedPolicyRules.length - ownedRules.length - policyDefinitions.length)
    //     throw new BadRequestHttpError("Update not allowed: this query introduces quads that have nothing to do with the policy/rules you own");

    // 4 Modify the storage to the updated version
    try {
        // Since no update function is available, we need to remove the old one and set the updated one
        await storage.deleteRule(policyId);

        // Add the other quads back into the policy
        policyStore.addQuads([...otherPolicyRules, ...otherRules]);
        await storage.addRule(policyStore);
    } catch (error) {
        throw new InternalServerError("Something went wrong while editting the policy:", error);
    }

    // 7. Print information within reach
    const finalState = getPolicyInfo(policyId, policyStore, clientId);
    return quadsToText([...finalState.policyDefinitions, ...finalState.ownedPolicyRules, ...finalState.ownedRules]);
}