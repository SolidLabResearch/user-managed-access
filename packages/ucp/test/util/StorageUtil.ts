import { basicPolicy } from "../../src/policy/ODRL";
import { SimplePolicy, UCPPolicy } from "../../src/policy/UsageControlPolicy";
import { readLdpRDFResource } from "../../src/storage/ContainerUCRulesStorage";
import { UCRulesStorage } from "../../src/storage/UCRulesStorage";


export async function cleanStorage(storage: UCRulesStorage, policies: SimplePolicy[]) {
    for (const policy of policies) {
        await storage.deleteRule(policy.policyIRI);
    }
}/**
 * Create an instantiated usage control policy using ODRL and add it to the policy container
 * @param uconStorage
 * @param type
 * @returns
 */

export async function createPolicy(uconStorage: UCRulesStorage, type: UCPPolicy): Promise<SimplePolicy> {
    const policyIRI: string = `http://example.org/${new Date().valueOf()}#`;
    let SimplePolicy = basicPolicy(type, policyIRI);
    await uconStorage.addRule(SimplePolicy.representation);
    return SimplePolicy;
}

export async function purgePolicyStorage(containerURL: string): Promise<void> {
    const container = await readLdpRDFResource(fetch, containerURL);
    const children = container.getObjects(containerURL, "http://www.w3.org/ns/ldp#contains", null).map(value => value.value);
    for (const childURL of children) {
        try {
            await fetch(childURL, { method: "DELETE" });
        } catch (e) {
            console.log(`${childURL} could not be deleted`);
        }
    }
}

