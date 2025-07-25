import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { Quad, Store } from "n3";
import { odrlAssigner, relations, namedNode, quadsToText, checkBaseURL, retrieveID } from "./PolicyUtil";


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

// Interface to represent a policy based on a client
export interface OnePolicy {
    clientId: string;
    policyId: string;

    // Policy quads are split in three parts, to not leak information out of the clients reach
    // The definitions are every policy quad that do not declare a rule
    policyDefinitions: Quad[];
    ownedPolicyRules: Quad[];
    otherPolicyRules: Quad[];
    ownedRules: Quad[];
    otherRules: Quad[];
}

// Functional implementation to get one policy
export function getPolicyInfo(policyId: string, store: Store, clientId: string): OnePolicy {

    // 1. Find the rules that this policy defines
    const policyRules: Quad[] = relations.flatMap(relation =>
        store.getQuads(namedNode(policyId), relation, null, null)
    );

    // 2. Collect the policy quads unrelated to rules
    const policyDefinitions = store.getQuads(namedNode(policyId), null, null, null).filter(quad =>
        !policyRules.some(rule => quad.equals(rule))
    );

    // 3. Separate the rules owned by the client from the others
    const otherRules: Quad[] = [];
    const ownedRules: Quad[] = [];
    const ownedPolicyRules: Quad[] = [];
    const otherPolicyRules: Quad[] = [];
    policyRules.forEach(quad => {
        if (store.getQuads(quad.object, odrlAssigner, namedNode(clientId), null).length === 1) {
            // TODO: This is the step to be replaced with the recursive variant
            store.getQuads(quad.object, null, null, null).forEach(
                quad => ownedRules.push(quad)
            );
            ownedPolicyRules.push(quad);
        } else {
            // TODO: Once again, this is to be replaced with the recursive variant
            store.getQuads(quad.object, null, null, null).forEach(
                quad => otherRules.push(quad)
            );
            otherPolicyRules.push(quad);
        }

    });

    // 4. Return the detailed object
    return {
        policyId: policyId,
        clientId: clientId,
        policyDefinitions: policyDefinitions,
        ownedPolicyRules: ownedPolicyRules,
        otherPolicyRules: otherPolicyRules,
        ownedRules: ownedRules,
        otherRules: otherRules
    };

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

    const { policyDefinitions, ownedPolicyRules, ownedRules } = getPolicyInfo(policyId, store, clientId);

    if (ownedRules.length === 0)
        return {
            status: 204,
            headers: {
                'content-type': 'text/turtle', 'access-control-allow-origin': 'http://localhost:5173'
            },
            body: '',
        }

    return quadsToText([...policyDefinitions, ...ownedPolicyRules, ...ownedRules]);
}

// Fill the policyDetails store with
//     1. The policy definitions
//     2. The owned rules declared in the policy
// TODO: This is a depth 1 algorithm that has to be replaced
export function getFilteredPolicyQuads(dataStore: Store, policyDetails: Store, policyId: string, clientId: string) {
    dataStore.getQuads(namedNode(policyId), null, null, null).forEach(quad => {
        if (!(relations.map(r => r.value as string).includes(quad.predicate.id)) || dataStore.getQuads(quad.object, odrlAssigner, namedNode(clientId), null).length > 0)
            policyDetails.addQuad(quad);
    });
}


/**
 * Get all policy information relevant to the client in the request.
 * This iplementation searches for all subjects in relation with the policy with depth 1, a deeper algorithm is required.
 * 
 * @param param0 a request with the clients webID as authorization header.
 * @returns all policy information (depth 1) relevant to the client
 */
async function getAllPolicies(store: Store, clientId: string): Promise<HttpHandlerResponse<any>> {

    // Keep track of all the matching policies (use store because javascript does not know how sets work)
    const policyDetails: Store = new Store();
    const memory: Set<string> = new Set();

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

                // Because an ODRL policy may only have one assigner, we can now add all policy and rule information, except the policy quads that define other clients rules
                // Note that this is the only part of the function to be replaced with the recursive variant
                if (!memory.has(policy.id)) {
                    getFilteredPolicyQuads(store, policyDetails, policy.id, clientId);
                    memory.add(policy.id);
                }
                store.getQuads(rule, null, null, null).forEach(quad => policyDetails.addQuad(quad));
            }
        }
    }
    return quadsToText(policyDetails.getQuads(null, null, null, null));
}