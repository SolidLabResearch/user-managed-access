import { EyeJsReasoner, readText } from "koreografeye";
import * as Path from 'path';
import { PolicyExecutor } from "../../src/PolicyExecutor";
import { AccessMode } from '../../src/UMAinterfaces';
import { UcpPatternEnforcement } from "../../src/UcpPatternEnforcement";
import { UcpPlugin } from "../../src/plugins/UCPPlugin";
import { SimplePolicy } from "../../src/policy/UsageControlPolicy";
import { MemoryUCRulesStorage } from "../../src/storage/MemoryUCRulesStorage";
import { cleanStorage } from "../util/StorageUtil";
import { validate } from "../util/Validation";
import { readPolicy, readPolicyRequest, temporalReadPolicyOutOfBound, temporalReadPolicyWithinBound, temporalWritePolicyOutOfBound, temporalWritePolicyWithinBound, usePolicy, usePolicyRequest, writePolicy, writePolicyRequest } from "../util/Constants";

async function main() {
    // load plugin
    const plugins = { "http://example.org/dataUsage": new UcpPlugin() }
    // instantiate koreografeye policy executor
    const policyExecutor = new PolicyExecutor(plugins)
    // ucon storage
    const uconRulesStorage = new MemoryUCRulesStorage()
    // load N3 Rules from a directory | TODO: utils are needed
    const rulesDirectory = Path.join(__dirname, "..", "..", "rules")
    const n3Rules: string[] = [readText(Path.join(rulesDirectory, 'data-crud-rules.n3'))!, readText(Path.join(rulesDirectory, 'data-crud-temporal.n3'))!]
    // instantiate the enforcer using the policy executor,
    const ucpPatternEnforcement = new UcpPatternEnforcement(uconRulesStorage, n3Rules, new EyeJsReasoner([
        "--quiet",
        "--nope",
        "--pass"]), policyExecutor)

    let result: { successful: boolean, createdPolicies: SimplePolicy[] }
    let results: { successful: boolean, createdPolicies: SimplePolicy[] }[] = []


    // ask read access without policy present | should fail
    result = await validate({
        request: readPolicyRequest,
        policies: [],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [],
        descriptionMessage: "'read' access request while no policy present.",
    })
    results.push(result)

    // ask write access without policy present | should fail
    result = await validate({
        request: writePolicyRequest,
        policies: [],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [],
        descriptionMessage: "'write' access request while no policy present.",
    })
    results.push(result)

    // ask read access while write policy present
    result = await validate({
        request: readPolicyRequest,
        policies: [writePolicy],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [],
        descriptionMessage: "'read' access request while 'write' policy present.",
    })
    results.push(result)
    await cleanStorage(uconRulesStorage, result.createdPolicies)


    // ask write access while read policy present
    result = await validate({
        request: writePolicyRequest,
        policies: [readPolicy],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [],
        descriptionMessage: "'write' access request while 'read' policy present.",
    })
    results.push(result)
    await cleanStorage(uconRulesStorage, result.createdPolicies)

    // ask read access while temporal policy present (and no others) | out of bound
    result = await validate({
        request: readPolicyRequest,
        policies: [temporalReadPolicyOutOfBound],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [],
        descriptionMessage: "'read' access request while temporal 'read' policy present. Out of bound, so no access",
    })
    results.push(result)
    await cleanStorage(uconRulesStorage, result.createdPolicies)

    // ask read access while temporal policy present (and no others) | within bound 
    result = await validate({
        request: readPolicyRequest,
        policies: [temporalReadPolicyWithinBound],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [AccessMode.read],
        descriptionMessage: "'read' access request while temporal 'read' policy present. Within bound.",
    })
    results.push(result)
    await cleanStorage(uconRulesStorage, result.createdPolicies)

    // ask write access while temporal policy present (and no others) | out of bound
    result = await validate({
        request: writePolicyRequest,
        policies: [temporalWritePolicyOutOfBound],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [],
        descriptionMessage: "'write' access request while temporal 'write' policy present. Out of bound, so no access",
    })
    results.push(result)
    await cleanStorage(uconRulesStorage, result.createdPolicies)

    // ask write access while temporal policy present (and no others) | within bound 
    result = await validate({
        request: writePolicyRequest,
        policies: [temporalWritePolicyWithinBound],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [AccessMode.write],
        descriptionMessage: "'write' access request while temporal 'write' policy present. Within bound.",
    })
    results.push(result)
    await cleanStorage(uconRulesStorage, result.createdPolicies)

    // ask read access while read policy present
    result = await validate({
        request: readPolicyRequest,
        policies: [readPolicy],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [AccessMode.read],
        descriptionMessage: "'read' access request while 'read' policy present.",
    })
    results.push(result)
    await cleanStorage(uconRulesStorage, result.createdPolicies)

    // ask write access while write policy present
    result = await validate({
        request: writePolicyRequest,
        policies: [writePolicy],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [AccessMode.write],
        descriptionMessage: "'write' access request while 'write' policy present.",
    })
    results.push(result)
    await cleanStorage(uconRulesStorage, result.createdPolicies)

    // ask read and write access while use policy present
    result = await validate({
        request: usePolicyRequest,
        policies: [usePolicy],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [AccessMode.write, AccessMode.read],
        descriptionMessage: "'read' and 'write' access request while 'use' policy present.",
    })
    results.push(result)
    await cleanStorage(uconRulesStorage, result.createdPolicies)

    let amountErrors = results.filter(result => !result.successful).length
    if (amountErrors) {
        console.log("Amount of errors:", amountErrors); // only log amount of errors if there are any
    }
}
main()

