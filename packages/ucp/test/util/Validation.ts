import { App, AppRunner, AppRunnerInput } from "@solid/community-server";
import * as fs from 'fs';
import * as Path from 'path';
import { Explanation, serializePremises } from "../../src/Explanation";
import { UconRequest } from "../../src/Request";
import { AccessMode } from "../../src/UMAinterfaces";
import { UconEnforcementDecision } from "../../src/UcpPatternEnforcement";
import { SimplePolicy, UCPPolicy } from "../../src/policy/UsageControlPolicy";
import { UCRulesStorage } from "../../src/storage/UCRulesStorage";
import { createPolicy } from "./StorageUtil";

export async function configSolidServer(port: number): Promise<App> {
    const input: AppRunnerInput = {
        config: Path.join(__dirname, "../", "memory.json"),
        variableBindings: {
            'urn:solid-server:default:variable:port': port,
            'urn:solid-server:default:variable:baseUrl': `http://localhost:${port}/`,
            'urn:solid-server:default:variable:loggingLevel': 'warn',
        }
    }
    const cssRunner = await new AppRunner().create(input)
    return cssRunner
}

// util function that checks whether lists contain the same elements
export function eqList(as: any[], bs: any[]): boolean {
    return as.length === bs.length && as.every(a => bs.includes(a))
}

/**
 * Really needs a better name.
 * It stores combined request (context) + policies and the rules interpreting those two.
 * Print out the file name
 * Print out instructions for eye to reason over it (assuming eye is locally installed)
 */
export function storeToReason(combined: string): void {
    const debugDirectory = Path.join(__dirname, "..", 'debug')
    const fileName = Path.join(debugDirectory, `fullRequest-${new Date().valueOf()}.n3`);
    console.log('execute with eye:', `\neye --quiet --nope --pass-only-new ${fileName}`);
    
    // note: not very efficient to this all the time
    createDirIfNotExists(debugDirectory);
    fs.writeFileSync(fileName, combined)
}
// create debug directory if it doesn't exist yet
const createDirIfNotExists = (dir: fs.PathLike) =>
    !fs.existsSync(dir) ? fs.mkdirSync(dir) : undefined;
/**
 * Util function to debug why a certain test went wrong
 * @param policies 
 * @param request 
 * @param n3Rules 
 */
export function debug(policies: SimplePolicy[], request: UconRequest, n3Rules: string): void {
    const combined = serializePremises(policies, request, n3Rules)
    storeToReason(combined)
}

/**
 * Validates a request to an ucon rules set and its interepretation.
 * Will produce a proper log when the test fails.
 * To do the decision calculation `calculateAccessModes` from {@link UconEnforcementDecision} is used.
 * 
 * Note: Currently does not clean up the ucon rules storage (it only adds).
 * @param input 
 * @returns 
 */
export async function validate(input: {
    request: UconRequest,
    policies: UCPPolicy[],
    ucpExecutor: UconEnforcementDecision,
    storage: UCRulesStorage,
    descriptionMessage?: string,
    validationMessage?: string,
    expectedAccessModes: AccessMode[],
    n3Rules: string[]
}): Promise<{ successful: boolean, createdPolicies: SimplePolicy[] }> {
    const { request, policies, ucpExecutor, storage, expectedAccessModes } = input;
    // add policies
    const createdPolicies: SimplePolicy[] = [];
    for (const policy of policies) {
        const created = await createPolicy(storage, policy);
        createdPolicies.push(created)
    }
    // ucp decision
    const explanation = await ucpExecutor.calculateAccessModes(request);

    // debug info
    if (input.descriptionMessage) console.log(input.descriptionMessage);
    const validationMessage = input.validationMessage ?? "Access modes present:"
    console.log(validationMessage, explanation, "Access modes that should be present:", expectedAccessModes);

    const successful = eqList(explanation, expectedAccessModes)
    if (!successful) {
        console.log("This policy is wrong.");
        debug(createdPolicies, request, input.n3Rules.join('\n'))
    }
    console.log();
    return {successful, createdPolicies}
}

/**
 * Validates a request to an ucon rules set and its interepretation.
 * Will produce a proper log when the test fails.
 * To do the decision calculation `calculateAndExplainAccessModes` from {@link UconEnforcementDecision} is used.
 * 
 * Note: Currently does not clean up the ucon rules storage (it only adds).
 * @param input 
 * @returns 
 */
export async function validateAndExplain(input: {
    request: UconRequest,
    policies: UCPPolicy[],
    ucpExecutor: UconEnforcementDecision,
    storage: UCRulesStorage,
    descriptionMessage?: string,
    validationMessage?: string,
    expectedAccessModes: AccessMode[],
    n3Rules: string[]
}): Promise<{ successful: boolean, explanation: Explanation, createdPolicies: SimplePolicy[] }> {
    const { request, policies, ucpExecutor, storage, expectedAccessModes } = input;
    // add policies
    const createdPolicies: SimplePolicy[] = [];
    for (const policy of policies) {
        const created = await createPolicy(storage, policy);
        createdPolicies.push(created)
    }
    // ucp decision
    const explanation = await ucpExecutor.calculateAndExplainAccessModes(request);

    // debug info
    if (input.descriptionMessage) console.log(input.descriptionMessage);
    const validationMessage = input.validationMessage ?? "Access modes present:"
    console.log(validationMessage, explanation.decision, "Access modes that should be present:", expectedAccessModes);

    const successful = eqList(explanation.decision, expectedAccessModes)
    if (!successful) {
        console.log("This policy is wrong.");
        debug(createdPolicies, request, input.n3Rules.join('\n'))
    }
    console.log();
    return { successful, explanation, createdPolicies }
}