import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { Quad, Store, Writer } from "n3";
import { odrlAssigner, relations, namedNode } from "./helpers";
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

    // Query the quads that have the requested client as assigner
    const quads = store.getQuads(null, odrlAssigner, namedNode(clientId), null);

    // For every rule that has `client` as `assigner`, get its policy
    const policies = new Set<string>();

    const rules = quads.map(quad => quad.subject);
    for (const relation of relations) {
        for (const rule of rules) {
            const foundPolicies = store.getQuads(null, relation, rule, null);
            for (const quad of foundPolicies) {
                policies.add(quad.subject.value);
            }
        }
    }

    // We use these policies to search everything about them, this will be changed to a recursive variant
    let policyDetails: Quad[] = [];

    for (const policy of policies) {
        const directQuads: Quad[] = store.getQuads(policy, null, null, null);
        const relatedQuads: Quad[] = [];
        for (const relation of relations) {
            const relatedNodes = store.getQuads(policy, relation, null, null);
            for (const q of relatedNodes) {
                // Look at the rule in relation to the policy
                const targetNode = q.object;
                // Now find every quad over that rule, without check if the rule is assigned by our client
                relatedQuads.push(...store.getQuads(targetNode, null, null, null));
            }
        }
        policyDetails = policyDetails.concat([...directQuads, ...relatedQuads]);
    }

    // Serialize as Turtle
    const writer = new Writer({ format: 'Turtle' });
    writer.addQuads(policyDetails);

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