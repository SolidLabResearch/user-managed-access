import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { Quad, Store } from "n3";
import { odrlAssigner, relations, namedNode, quadsToText, checkBaseURL, retrieveID } from "./PolicyUtil";
import { MethodNotAllowedHttpError } from "@solid/community-server";


/**
 * Handling of the GET /uma/policies endpoint
 * 
 * @param request will give all policies when no <id> is fixed in the URL, otherwise it will give the required policy (if allowed)
 */
export async function getPolicies(request: HttpHandlerRequest, store: Store, clientId: string, baseUrl: string): Promise<HttpHandlerResponse<any>> {
    // This shouldn't happen
    const pathname = checkBaseURL(request, baseUrl);

    // If no other argument(s), get all
    if (pathname === '/policies')
        return getAllPolicies(store, clientId);

    // If asked for a policy, get one
    const id = retrieveID(pathname);
    return getOnePolicy(id, store, clientId);

}

/**
 * Function to implement the GET /uma/policies/<id> endpoint, it retrieves all information about a certain
 * policy if available. 
 * 
 * @param policyId the policy id, which is ENCODED
 * @param store
 * @param clientId the clients webID
 * @returns aynchronous HTTP response: 
 */
async function getOnePolicy(policyId: string, store: Store, clientId: string): Promise<HttpHandlerResponse<any>> {
    policyId = decodeURIComponent(policyId);

    // 1. Search the policy by ID
    const policyMatches = store.getQuads(namedNode(policyId), null, null, null);

    // 2. Find the rules that this policy defines
    let policyRules: Quad[] = []
    for (const relation of relations) {
        policyRules = [...policyRules, ...store.getQuads(namedNode(policyId), relation, null, null)]
    }

    // 3. Only keep the rules assigned by the client
    const ownedRules = policyRules.filter(quad => store.getQuads(quad.object, odrlAssigner, namedNode(clientId), null).length > 0);
    // Return an empty body when no rules are found
    if (ownedRules.length === 0) {
        return {
            status: 200,
            headers: {
                'content-type': 'text/turtle',
            },
            body: '',
        };
    }

    // 4. Search all info about the policy AND the rules, for now with depth 1 but a recursive variant needs to be implemented here.
    let details: Set<Quad> = new Set(policyMatches);
    ownedRules.forEach((rule) => {
        store.getQuads(rule.object, null, null, null).forEach(q => details.add(q));
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