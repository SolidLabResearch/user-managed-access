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

    return quadsToText(policyDetails)
}