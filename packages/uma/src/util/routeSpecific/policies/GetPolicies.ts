import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { Quad, Store, Writer } from "n3";
import { odrlAssigner, relations, namedNode, quadsToText } from "./helpers";
import { BadRequestHttpError, InternalServerError, MethodNotAllowedHttpError } from "@solid/community-server";
import { NotImplementedError } from "@inrupt/solid-client-authn-core";

/**
 * Handling of the GET /uma/policies endpoint
 * 
 * @param request will give all policies when no <id> is fixed in the URL, otherwise it will give the required policy (if allowed)
 */
export async function getPolicies(request: HttpHandlerRequest, store: Store, clientId: string): Promise<HttpHandlerResponse<any>> {
    if (request.url.pathname === '/uma/policies')
        return getAllPolicies(store, clientId);

    // If asked for a policy, validate the policy ID
    const args = request.url.pathname.split('/');
    if (args.length === 4 && isPolicy(args[3]))
        return getOnePolicy(args[3], store, clientId);

    throw new MethodNotAllowedHttpError();
}

/**
 * Function to determine the validity of the <id> of the GET /uma/policies/<id> endpoint (not implemented yet)
 * 
 * @param policyId 
 * @returns the validity of policyId
 */
function isPolicy(policyId: string): boolean {
    // TODO
    return true;
}

/**
 * Function to implement the GET /uma/policies/<id> endpoint, it retrieves all information about a certain
 * policy if available. 
 */
async function getOnePolicy(policyId: string, store: Store, clientId: string): Promise<HttpHandlerResponse<any>> {
    policyId = decodeURIComponent(policyId);

    // 1. Search the policy by ID
    const policyMatches = store.getQuads(namedNode(policyId), null, null, null);

    // 2. Find the rules in the policy assigned by the client (first find the clients rules, then filter the ones based on the policy)
    const ownedRules = store.getQuads(null, odrlAssigner, namedNode(clientId), null);
    const filteredRules = ownedRules.filter(rule =>
        policyMatches.some(quad => quad.object.id === rule.subject.id)
    );

    // 3. Check if there are no other assigners in this policy (this is against ODRL definition of a policy)
    const otherAssigners = store.getQuads(null, odrlAssigner, null, null);
    if (ownedRules.length < otherAssigners.length) {
        // TODO: We might expose information, handle here
        throw new NotImplementedError("Handling of policies with multiple assigners is yet to be implemented");
    }

    // 4. Search all info about the policy AND the rules, for now with depth 1 but a recursive variant needs to be implemented.
    let details: Set<Quad> = new Set(policyMatches);
    filteredRules.forEach((rule) => {
        details.add(rule);
        store.getQuads(rule.subject, null, null, null).forEach(q => details.add(q))
    });

    return quadsToText(Array.from(details));
}


/**
 * Get all policy information relevant to the client in the request.
 * This iplementation searches for all subjects in relation with the policy with depth 1, a deeper algorithm is required.
 * 
 * @param param0 a request with the clients webID as authorization header.
 * @returns all policy information (depth 1) relevant to the client
 */
async function getAllPolicies(store: Store, clientId: string): Promise<HttpHandlerResponse<any>> {

    // Keep track of all the matching policies
    const policyDetails: Set<Quad> = new Set();

    for (const relation of relations) {
        // Collect every quad that matches with the relation (one of Permission, Prohibition or Duty)
        const matchingRules = store.getQuads(null, relation, null, null);

        // Every quad will represent a policy in relation with a rule
        for (const quad of matchingRules) {
            // Extract the policy and rule out the quad
            const policy = quad.subject;
            const rule = quad.object;

            // Only go on if the rule is assigned by the client
            if (store.getQuads(rule, odrlAssigner, namedNode(clientId), null).length > 0) {

                // Because an ODRL policy may only have one assigner, we can now add all policy and rule information
                store.getQuads(policy, null, null, null).forEach(quad => policyDetails.add(quad));
                store.getQuads(rule, null, null, null).forEach(quad => policyDetails.add(quad));
            }
        }
    }

    return quadsToText(Array.from(policyDetails));
}