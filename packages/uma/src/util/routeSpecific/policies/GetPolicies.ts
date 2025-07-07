import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { Quad, Store, Writer } from "n3";
import { odrlAssigner, relations, namedNode } from "./PolicyUtil";
import { MethodNotAllowedHttpError } from "@solid/community-server";

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
    if (args.length === 4 && isPolicy(args[-1]))
        return getOnePolicy(args[-1], store, clientId);

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
 * policy if available. Yet to be implemented.
 */
function getOnePolicy(policyId: string, store: Store, clientId: string): Promise<HttpHandlerResponse<any>> {
    // TODO
    return getAllPolicies(store, clientId);
}


/**
 * Get all policy information relevant to the client in the request.
 * This iplementation searches for all subjects in relation with the policy with depth 1, a deeper algorithm is required.
 * 
 * @param param0 a request with the clients webID as authorization header.
 * @returns all policy information (depth 1) relevant to the client
 */
function getAllPolicies(store: Store, clientId: string): Promise<HttpHandlerResponse<any>> {

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


    // Serialize as Turtle
    const writer = new Writer({ format: 'Turtle' });
    writer.addQuads(Array.from(policyDetails));

    return new Promise<HttpHandlerResponse<any>>((resolve, reject) => {
        writer.end((error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve({
                    status: 200,
                    headers: { 'content-type': 'text/turtle' },
                    body: result
                });
            }
        });
    });
}