const crud = `
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix : <http://example.org/> .
@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix fno:  <https://w3id.org/function/ontology#> .
@prefix log: <http://www.w3.org/2000/10/swap/log#> .
@prefix string: <http://www.w3.org/2000/10/swap/string#> .
@prefix list: <http://www.w3.org/2000/10/swap/list#> .


# Read ODRL rule
{ 
  	?permission a odrl:Permission;
      	odrl:action ?action ;
      	odrl:target ?targetResource ;
      	odrl:assignee ?requestedParty;
      	odrl:assigner ?resourceOwner .   
		
	?action list:in (odrl:use odrl:read) . # multiple options

    ?SCOPE log:notIncludes { ?permission odrl:constraint ?anything }. # No odrl:constraints may be present

    # context of a request
  	?context 
        :resourceOwner ?resourceOwner;
      	:requestingParty ?requestedParty;
      	:target ?targetResource;
      	:requestPermission acl:Read.

    :uuid5 log:uuid ?uuidStringdataUsagePolicyExecution.
    ( "urn:uuid:" ?uuidStringdataUsagePolicyExecution) string:concatenation ?urnUuidStringdataUsagePolicyExecution.
    ?dataUsagePolicyExecution log:uri ?urnUuidStringdataUsagePolicyExecution .
} =>
{
    ?dataUsagePolicyExecution a fno:Execution;
        fno:executes <http://example.org/dataUsage> ; 
        :accessModesAllowed acl:Read.
}.

# Update ODRL Rule (odrl:modify: new asset is not created, not same as acl:write)
{ 
  	?permission a odrl:Permission;
      	odrl:action ?action ;
      	odrl:target ?targetResource ;
      	odrl:assignee ?requestedParty;
      	odrl:assigner ?resourceOwner .   
		
	?action list:in (odrl:use odrl:modify). # multiple options

    ?SCOPE log:notIncludes { ?permission odrl:constraint ?anything }. # No odrl:constraints may be present

    # context of a request
  	?context 
        :resourceOwner ?resourceOwner;
      	:requestingParty ?requestedParty;
      	:target ?targetResource;
      	:requestPermission acl:Write.

    :uuid6 log:uuid ?uuidStringdataUsagePolicyExecution.
    ( "urn:uuid:" ?uuidStringdataUsagePolicyExecution) string:concatenation ?urnUuidStringdataUsagePolicyExecution.
    ?dataUsagePolicyExecution log:uri ?urnUuidStringdataUsagePolicyExecution .
} =>
{
    ?dataUsagePolicyExecution a fno:Execution;
        fno:executes <http://example.org/dataUsage> ; 
        :accessModesAllowed acl:Write.
}.
`

import { EyeJsReasoner } from "koreografeye";
import { PolicyExecutor, SimplePolicy, UconRequest, UcpPatternEnforcement, UcpPlugin, turtleStringToStore, MemoryUCRulesStorage } from "@solidlab/ucp";



/**
 * Interface for a Usage Control Policy.
 * Note: a Usage Control policy currently only has one rule.
 */
export interface UCPPolicy {
    action: string,
    owner: string,
    resource: string,
    requestingParty: string,
    constraints?: Constraint[]
}

/**
 * Interface for a Usage Control Policy Constraint
 */
export interface Constraint {
    type: string,
    operator: string,
    value: any
}

/**
 * Create a simple policy with an agreement and one rule
 * Note: should and can be made synchronous
 * @param type 
 * @param baseIri 
 * @returns 
 */
export async function basicPolicy(type: UCPPolicy, baseIri?: string): Promise<SimplePolicy> {
    baseIri = baseIri ?? `http://example.org/${new Date().valueOf()}#` // better would be uuid
    const agreement = baseIri + "usagePolicy";
    const rule = baseIri + "permission";
    const policy = `@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
    @prefix acl: <http://www.w3.org/ns/auth/acl#>.

    <${agreement}>
      a odrl:Agreement ;
      odrl:permission <${rule}>.
    
    <${rule}>
      a odrl:Permission ;
      odrl:action <${type.action}> ;
      odrl:target <${type.resource}>;
      odrl:assignee <${type.requestingParty}> ;
      odrl:assigner <${type.owner}> .`

    const constraints = createConstraints(rule, type.constraints ?? [])

    const policyStore = await turtleStringToStore([policy, constraints].join("\n"))

    return { representation: policyStore, agreementIRI: agreement, ruleIRI: rule }
}

export function createConstraints(ruleIRI: string, constraints: Constraint[]): string {
    let constraintsString = ""
    for (const constraint of constraints) {
        // note: only temporal constraints currently, so the type is not checked
        constraintsString += `@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
        @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
        <${ruleIRI}> odrl:constraint [
            odrl:leftOperand odrl:dateTime ;
            odrl:operator <${constraint.operator}> ;
            odrl:rightOperand "${(constraint.value as Date).toISOString()}"^^xsd:dateTime ] .
        `
    }
    return constraintsString
}

async function main() {
    // Note: assumption - Solid server is set up with public read and write access on port 3123
    // $ npx @solid/community-server -p 3123 -c memory.json 

    // constants
    const aclRead = "http://www.w3.org/ns/auth/acl#Read"
    const aclWrite = "http://www.w3.org/ns/auth/acl#Write"
    const odrlRead = "http://www.w3.org/ns/odrl/2/read"
    const odrlWrite = "http://www.w3.org/ns/odrl/2/modify"
    const odrlUse = "http://www.w3.org/ns/odrl/2/use"

    const owner = "https://pod.woutslabbinck.com/profile/card#me"
    const resource = "http://localhost:3000/test.ttl"
    const requestingParty = "https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me"

    // requests
    const readPolicyRequest: UconRequest = {
        subject: requestingParty, action: [aclRead], resource: resource, owner: owner
    }
    const writePolicyRequest: UconRequest = {
        subject: requestingParty, action: [aclWrite], resource: resource, owner: owner
    }
    const usePolicyRequest: UconRequest = {
        subject: requestingParty, action: [aclWrite, aclRead], resource: resource, owner: owner
    }

    // policies 
    const readPolicy: UCPPolicy = { action: odrlRead, owner, resource, requestingParty }
    const writePolicy: UCPPolicy = { action: odrlWrite, owner, resource, requestingParty }
    const temporalReadPolicyOutOfBound: UCPPolicy = {
        action: odrlRead, owner, resource, requestingParty,
        constraints: [
            { operator: "http://www.w3.org/ns/odrl/2/gt", type: "temporal", value: new Date("2024-01-01") }, // from: must be greater than given date
            { operator: "http://www.w3.org/ns/odrl/2/lt", type: "temporal", value: new Date("2024-01-02") }, // to: must be smaller than given date
        ]
    }
    const temporalReadPolicyWithinBound: UCPPolicy = {
        action: odrlRead, owner, resource, requestingParty,
        constraints: [
            { operator: "http://www.w3.org/ns/odrl/2/gt", type: "temporal", value: new Date(0) }, // from: must be greater than given date
            { operator: "http://www.w3.org/ns/odrl/2/lt", type: "temporal", value: new Date(new Date().valueOf() + 30_000) }, // to: must be smaller than given date
        ]
    }
    const temporalWritePolicyOutOfBound: UCPPolicy = {
        action: odrlWrite, owner, resource, requestingParty,
        constraints: [
            { operator: "http://www.w3.org/ns/odrl/2/gt", type: "temporal", value: new Date("2024-01-01") }, // from: must be greater than given date
            { operator: "http://www.w3.org/ns/odrl/2/lt", type: "temporal", value: new Date("2024-01-02") }, // to: must be smaller than given date
        ]
    }
    const temporalWritePolicyWithinBound: UCPPolicy = {
        action: odrlWrite, owner, resource, requestingParty,
        constraints: [
            { operator: "http://www.w3.org/ns/odrl/2/gt", type: "temporal", value: new Date(0) }, // from: must be greater than given date
            { operator: "http://www.w3.org/ns/odrl/2/lt", type: "temporal", value: new Date(new Date().valueOf() + 30_000) }, // to: must be smaller than given date
        ]
    }
    const usePolicy: UCPPolicy = { action: odrlUse, owner, resource, requestingParty }

    // load plugin
    const plugins = { "http://example.org/dataUsage": new UcpPlugin() }
    // instantiate koreografeye policy executor
    const policyExecutor = new PolicyExecutor(plugins)
    // ucon storage
    const uconRulesStorage = new MemoryUCRulesStorage()
    // load N3 Rules from a directory | TODO: utils are needed
    const n3Rules: string[] = [crud]
    // instantiate the enforcer using the policy executor,
    const ucpPatternEnforcement = new UcpPatternEnforcement(uconRulesStorage, n3Rules, new EyeJsReasoner([
        "--quiet",
        "--nope",
        "--pass"]), policyExecutor)

    const policy = await basicPolicy(readPolicy)
    await uconRulesStorage.addRule(policy.representation)
    const result = await ucpPatternEnforcement.calculateAccessModes(readPolicyRequest)
    console.log(result);
}
main()
