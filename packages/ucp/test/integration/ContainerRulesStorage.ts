import { EyeJsReasoner, readText } from "koreografeye";
import * as Path from 'path';
import { Explanation, explanationToRdf } from "../../src/Explanation";
import { PolicyExecutor } from "../../src/PolicyExecutor";
import { AccessMode } from '../../src/UMAinterfaces';
import { UcpPatternEnforcement } from "../../src/UcpPatternEnforcement";
import { UCPLogPlugin } from "../../src/plugins/UCPLogPlugin";
import { ContainerUCRulesStorage } from "../../src/storage/ContainerUCRulesStorage";
import { storeToString } from "../../src/util/Conversion";
import { configSolidServer, validateAndExplain } from "../util/Validation";
import { purgePolicyStorage } from "../util/StorageUtil";
import { readPolicy, readPolicyRequest, temporalReadPolicyOutOfBound, temporalReadPolicyWithinBound, temporalWritePolicyOutOfBound, temporalWritePolicyWithinBound, usePolicy, usePolicyRequest, writePolicy, writePolicyRequest } from "../util/Constants";

// uses the log engine with container rules storage
async function main() {
    const portNumber = 3123
    const containerURL = `http://localhost:${portNumber}/`

    // start server
    // configured as following command: $ npx @solid/community-server -p 3123 -c config/memory.json     
    const server = await configSolidServer(portNumber)
    await server.start()

    // set up policy container
    const uconRulesContainer = `${containerURL}ucon/`
    await fetch(uconRulesContainer, {
        method: "PUT"
    }).then(res => console.log("status creating ucon container:", res.status))
    console.log();

    // load plugin
    const plugins = { "http://example.org/dataUsageLog": new UCPLogPlugin() }
    // instantiate koreografeye policy executor
    const policyExecutor = new PolicyExecutor(plugins)
    // ucon storage
    const uconRulesStorage = new ContainerUCRulesStorage(uconRulesContainer)
    // load N3 Rules from a directory | TODO: utils are needed
    const rulesDirectory = Path.join(__dirname, "..", "..", "rules")
    const n3Rules: string[] = [readText(Path.join(rulesDirectory, 'log-usage-rule.n3'))!]
    // instantiate the enforcer using the policy executor,
    const ucpPatternEnforcement = new UcpPatternEnforcement(uconRulesStorage, n3Rules, new EyeJsReasoner([
        "--quiet",
        "--nope",
        "--pass"]), policyExecutor)

    let result: { successful: boolean, explanation: Explanation }
    let results: { successful: boolean, explanation: Explanation }[] = []

    // ask read access without policy present | should fail
    result = await validateAndExplain({
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

    result = await validateAndExplain({
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
    result = await validateAndExplain({
        request: readPolicyRequest,
        policies: [writePolicy],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [],
        descriptionMessage: "'read' access request while 'write' policy present.",
    })
    results.push(result)
    await purgePolicyStorage(uconRulesContainer);


    // ask write access while read policy present
    result = await validateAndExplain({
        request: writePolicyRequest,
        policies: [readPolicy],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [],
        descriptionMessage: "'write' access request while 'read' policy present.",
    })
    results.push(result)
    await purgePolicyStorage(uconRulesContainer);

    // ask read access while temporal policy present (and no others) | out of bound
    result = await validateAndExplain({
        request: readPolicyRequest,
        policies: [temporalReadPolicyOutOfBound],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [],
        descriptionMessage: "'read' access request while temporal 'read' policy present. Out of bound, so no access",
    })
    results.push(result)
    await purgePolicyStorage(uconRulesContainer);

    // ask read access while temporal policy present (and no others) | within bound 
    result = await validateAndExplain({
        request: readPolicyRequest,
        policies: [temporalReadPolicyWithinBound],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [],
        descriptionMessage: "'read' access request while temporal 'read' policy present. Within bound. However, no N3 rule for interpretation.",
    })
    results.push(result)
    await purgePolicyStorage(uconRulesContainer);

    // ask write access while temporal policy present (and no others) | out of bound
    result = await validateAndExplain({
        request: writePolicyRequest,
        policies: [temporalWritePolicyOutOfBound],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [],
        descriptionMessage: "'write' access request while temporal 'write' policy present. Out of bound, so no access",
    })
    results.push(result)
    await purgePolicyStorage(uconRulesContainer);

    // ask write access while temporal policy present (and no others) | within bound 
    result = await validateAndExplain({
        request: writePolicyRequest,
        policies: [temporalWritePolicyWithinBound],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [],
        descriptionMessage: "'write' access request while temporal 'write' policy present. Within bound. However, no N3 rule for interpretation.",
    })
    results.push(result)
    await purgePolicyStorage(uconRulesContainer);

    // ask read access while read policy present
    result = await validateAndExplain({
        request: readPolicyRequest,
        policies: [readPolicy],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [AccessMode.read],
        descriptionMessage: "'read' access request while 'read' policy present.",
    })
    results.push(result)
    await purgePolicyStorage(uconRulesContainer);

    // ask write access while write policy present
    result = await validateAndExplain({
        request: writePolicyRequest,
        policies: [writePolicy],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [AccessMode.write],
        descriptionMessage: "'write' access request while 'write' policy present.",
    })
    results.push(result)
    await purgePolicyStorage(uconRulesContainer);

    // ask read and write access while use policy present
    result = await validateAndExplain({
        request: usePolicyRequest,
        policies: [usePolicy],
        ucpExecutor: ucpPatternEnforcement,
        storage: uconRulesStorage,
        n3Rules: n3Rules,
        expectedAccessModes: [AccessMode.write, AccessMode.read],
        descriptionMessage: "'read' and 'write' access request while 'use' policy present.",
    })
    results.push(result)
    await purgePolicyStorage(uconRulesContainer);

    let amountErrors = results.filter(result => !result.successful).length
    if (amountErrors) {
        console.log("Amount of errors:", amountErrors); // only log amount of errors if there are any
        for (const result of results.filter(result => !result.successful)) {
            console.log(storeToString(explanationToRdf(result.explanation)));
        }
    }
    // stop server
    await server.stop()
}
main()

