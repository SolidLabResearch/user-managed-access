import { Quad, Quad_Subject, Store } from "n3";
import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { namedNode, odrlAssigner, relations } from "./PolicyUtil";
import { BadRequestHttpError, InternalServerError } from "@solid/community-server";
import { parseStringAsN3Store } from "koreografeye";
import { UCRulesStorage } from "@solidlab/ucp";

export async function addPolicies(request: HttpHandlerRequest, store: Store, storage: UCRulesStorage, clientId: string): Promise<HttpHandlerResponse<any>> {

    // 1. Parse the requested policy

    // Regex check for content type
    const contentType = request.headers['content-type'];
    if (!/(?:n3|trig|turtle|nquads?|ntriples?)$/i.test(contentType)) {
        throw new BadRequestHttpError(`Content-Type ${contentType} is not supported.`);
    }

    console.log("Requested Policy:", request.body)
    let requestedPolicy;
    if (Buffer.isBuffer(request.body)) {
        requestedPolicy = request.body.toString('utf-8');
        console.log('RDF body:', requestedPolicy);
    } else {
        throw new Error("Expected Buffer body");
    }
    let parsedPolicy: Store;
    try {
        parsedPolicy = await parseStringAsN3Store(requestedPolicy, { format: contentType });
    } catch (error) {
        throw new BadRequestHttpError(`Policy string can not be parsed: ${error}`)
    }

    // 2. Sanitization checks

    // Check that every rule defined by the policy has exactly one assigner, every rule is unique and every assigner is the client
    const definedRules = new Set();
    for (const relation of relations) {

        // Every rule definition of every policy
        const policyRelationRules = parsedPolicy.getQuads(null, relation, null, null);

        for (const quad of policyRelationRules) {
            const rule = quad.object;

            // The policy should not define multiple rules with the same ID, this check also 
            // restricts the same rule to be defined twice (even if relation is equal)
            if (definedRules.has(rule)) throw new BadRequestHttpError(`Rule ambiguity in rule ${rule.id}`);
            definedRules.add(rule);

            // The rule should have exactly one assigner, and it should be the client
            const ruleAssignerX = parsedPolicy.getQuads(rule, odrlAssigner, null, null);

            if (ruleAssignerX.length !== 1) throw new BadRequestHttpError(`Rule ${rule.id} should have exactly one assigner`);
            if (ruleAssignerX[0].object.id !== clientId) throw new BadRequestHttpError(`Rule ${rule.id} needs an authorized assigner`);
        }
    }

    // Check if assigner of the policy has access to the target
    // Check if there is at least one permission/prohibition/duty
    // Check if every rule has a target
    // ...

    // 3 Add the policy to the rule storage
    try {
        await storage.addRule(parsedPolicy);
    } catch (error) {
        throw new InternalServerError("Failed to add policy");
    }


    return {
        status: 201
    }
}