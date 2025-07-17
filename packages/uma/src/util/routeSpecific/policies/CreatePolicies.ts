import { Quad, Store } from "n3";
import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { odrlAssigner, parseBodyToStore, relations } from "./PolicyUtil";
import { BadRequestHttpError, InternalServerError } from "@solid/community-server";
import { UCRulesStorage } from "@solidlab/ucp";
import { getPolicyInfo, OnePolicy } from "./GetPolicies";

export function sanitizeRule(parsedPolicy: Store, clientId: string, strict: boolean = false): Set<string> {
    // Check that every rule defined by the policy has exactly one assigner, every rule is unique and every assigner is the client
    const definedRules = new Set();
    const policyIds: Set<string> = new Set();
    for (const relation of relations) {

        // Every rule definition of every policy
        const policyRelationRules = parsedPolicy.getQuads(null, relation, null, null);

        for (const quad of policyRelationRules) {
            const rule = quad.object;
            policyIds.add(quad.subject.id);
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

    // Return the policies in the store for further use
    return policyIds;
}

export async function addPolicies(request: HttpHandlerRequest, store: Store, storage: UCRulesStorage, clientId: string): Promise<HttpHandlerResponse<any>> {

    // 1. Parse the requested policy
    const parsedPolicy = await parseBodyToStore(request);

    // 2. Sanitization checks (error is thrown when checks fail)
    const newPolicies = sanitizeRule(parsedPolicy, clientId);

    // Extra checks
    const totalQuads: Quad[] = [];
    if ([...newPolicies].some(id => {
        const existingInfo = getPolicyInfo(id, store, clientId);
        console.log(`
            INITIAL POLICY ${id}
            
            POLICY ITSELF - ${existingInfo.policyDefinitions.length}
                ${existingInfo.policyDefinitions}
                ${existingInfo.ownedPolicyRules}
                ${existingInfo.otherPolicyRules}
            
            OWNED RULES - ${existingInfo.ownedRules.length}
                ${existingInfo.ownedRules.length}
            
            OTHER RULES - ${existingInfo.otherRules.length}
                ${existingInfo.otherRules}

            TOTAL = ${parsedPolicy.getQuads(null, null, null, null).length}
            `)
        // None of these policies should already exist
        if ([...existingInfo.policyDefinitions, ...existingInfo.ownedPolicyRules, ...existingInfo.otherPolicyRules,
        ...existingInfo.ownedRules, ...existingInfo.otherRules].length > 0) {
            console.log('TEST: ALREADY EXISTS')
            return true;
        }

        const { policyDefinitions, ownedPolicyRules, otherPolicyRules, ownedRules, otherRules } = getPolicyInfo(id, parsedPolicy, clientId);

        console.log(`
            TEST FOR POLICY ${id}
            
            POLICY ITSELF - ${policyDefinitions.length}
                ${policyDefinitions}
                ${ownedPolicyRules}
                ${otherPolicyRules}
            
            OWNED RULES - ${ownedRules.length}
                ${ownedRules}
            
            OTHER RULES - ${otherRules.length}
                ${otherRules}

            TOTAL = ${parsedPolicy.getQuads(null, null, null, null).length}
            `)
        // The policies may not declare rules out of scope
        if (otherRules.length !== 0 || otherPolicyRules.length !== 0) {
            console.log("TEST: out of scope")
            return true;
        }

        totalQuads.push(...policyDefinitions, ...ownedPolicyRules, ...ownedRules);
    }))
        throw new BadRequestHttpError("POST not allowed: improper request body");

    // Extra check: No unrelated rules may be inserted
    // The policies may not declare any quads unrelated to its own policy
    const newQuads = parsedPolicy.getQuads(null, null, null, null);
    if (newQuads.length - totalQuads.length !== 0)
        throw new BadRequestHttpError("POST not allowed: inserted unrelated quads");


    // 3 Add the policy to the rule storage
    try {
        await storage.addRule(parsedPolicy);
    } catch (error) {
        throw new InternalServerError("Failed to add policy");
    }


    return {
        status: 201,
        headers: { 'access-control-allow-origin': 'http://localhost:5173' }
    }
}