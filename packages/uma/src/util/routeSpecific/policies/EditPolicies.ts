import { Quad, Store, Writer } from "n3";
import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { UCRulesStorage } from "@solidlab/ucp";
import { checkBaseURL, parseBufferToString, quadsToText, retrieveID } from "./PolicyUtil";
import { QueryEngine } from '@comunica/query-sparql';
import { BadRequestHttpError, InternalServerError } from "@solid/community-server";
import { getOnePolicyInfo } from "./GetPolicies";

// Apparently js does not have this
const setIsEqual = (xs: Quad[], ys: Quad[]) => {
    // if (xs.length === ys.length)
    //     [...xs].every((x) => {
    //         console.log([...ys].some(y => x.equals(y)))
    //         return [...ys].some(y => x.equals(y));
    //     })
    return xs.length === ys.length &&
        xs.every((x) => ys.some(y => x.equals(y)))
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
    const { policyDefinitions, ownedPolicyRules, otherPolicyRules, ownedRules, otherRules } = getOnePolicyInfo(policyId, store, clientId);

    // Implementation Choice: You cannot PATCH a policy that you are not affiliated with
    if (ownedRules.length === 0)
        throw new BadRequestHttpError("Update not allowed: You cannot update policies that you are not affiliated with");

    // 4. Execute the query on the policy
    const policyStore = new Store([...policyDefinitions, ...ownedPolicyRules, ...otherPolicyRules, ...ownedRules, ...otherRules]);
    const initialQuads = policyStore.getQuads(null, null, null, null);
    // const writer = new Writer('Turtle');
    // console.log(
    //     `
    //     -----------------------------------------------
    //     INITIAL LENGTHS AND LISTS:
    //     policy quads: ${policyQuads.length}
    //     ${writer.quadsToString([...policyQuads])}

    //     owned rules: ${ownedRules.length}
    //     ${writer.quadsToString([...ownedRules])}

    //     other rules: ${otherRules.length}
    //     ${writer.quadsToString([...otherRules])}

    //     initial length: ${initialQuads.length}
    //     #rules out of reach: ${initialQuads.length - policyQuads.length - ownedRules.length}
    //     -----------------------------------------------
    //     `
    // );

    try {
        await new QueryEngine().queryVoid(query, { sources: [policyStore] });
    } catch (error) {
        throw new BadRequestHttpError("Query could not be executed:", error);
    }

    // 5. Simple safety checks
    // Check that the other rules are unchanged

    const newState = getOnePolicyInfo(policyId, policyStore, clientId);
    // console.log(writer.quadsToString([...newState.otherRules]))
    if (!setIsEqual(newState.otherRules, otherRules))
        throw new BadRequestHttpError("Update not allowed: attempted to modify rules not owned by client");

    // Check that only Policy/Rule changing quads are introduced and removed
    // The only modifications we allow are policy definitions, policy rules that define owned rules and owned rules themselves
    const newQuads = policyStore.getQuads(null, null, null, null);
    // console.log(
    //     writer.quadsToString(newQuads)
    // );
    // console.log(
    //     `
    //     -----------------------------------------------
    //     NEW LENGTHS AND LISTS:
    //     policy quads: ${newState.policyQuads.length}
    //     ${writer.quadsToString([...newState.policyQuads])}

    //     owned rules: ${newState.ownedRules.length}
    //     ${writer.quadsToString([...newState.ownedRules])}

    //     other rules: ${newState.otherRules.length}
    //     ${writer.quadsToString([...otherRules])}

    //     new length: ${newQuads.length}
    //     #rules out of reach: ${newQuads.length - newState.policyQuads.length - newState.ownedRules.length}
    //     -----------------------------------------------


    //     check object reference
    //     old policy quads ${policyQuads.length}
    //     old owned rule quads ${ownedRules.length}
    //     `
    // );
    if (newQuads.length - newState.ownedRules.length - newState.ownedPolicyRules.length - newState.policyDefinitions.length
        !== initialQuads.length - ownedPolicyRules.length - ownedRules.length - policyDefinitions.length)
        throw new BadRequestHttpError("Update not allowed: this query introduces quads that have nothing to do with the policy/rules you own")

    // 6. Modify the storage to the updated version
    try {
        await storage.deleteRule(policyId);
        await storage.addRule(policyStore);
    } catch (error) {
        throw new InternalServerError("Something went wrong while editting the policy:", error);
    }

    // 7. Print information within reach
    const finalState = getOnePolicyInfo(policyId, policyStore, clientId);
    return quadsToText([...finalState.policyDefinitions, ...finalState.ownedPolicyRules, ...finalState.ownedRules]);
}