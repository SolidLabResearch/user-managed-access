/**
 * This test requires the ODRL Authorization Server to be running.
 *
 * The purpose of this file is to test the /policies endpoint.
 */

import { policyA, policyB, policyC, badPolicy1, changePolicy1, changePolicy95e, putPolicy95e, putPolicyB } from "./util/policyExamples";

const endpoint = (extra: string = '') => 'http://localhost:4000/uma/policies' + extra;
const client = (client: string = 'a') => `WebID ${encodeURIComponent(`https://pod.${client}.com/profile/card#me`)}`;
const policyId1 = 'http://example.org/usagePolicy1';
const policyId95e = 'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc'
const badPolicyId = 'nonExistentPolicy';
const quickBuffer = (text: string) => Buffer.from(text, 'utf-8');
let errorCounter = 0;

// Test if the first digit of the status code equals the second arg, or match the entire code when specific is false
const testCode = (code: number, shouldbe: number = 2, trunc: boolean = true) => {
    if ((trunc ? Math.trunc(Number(code) / 100) : code) !== shouldbe) { errorCounter++; console.log("here") }
}

async function putPolicies() {
    const encoded = encodeURIComponent(policyId95e);
    console.log("test PUT policies");

    // reset the policy to be sure
    await deleteAll();
    await postPolicy();

    let response = await fetch(endpoint(`/${encoded}`), { method: 'PUT', headers: { 'Authorization': client('a'), 'Content-Type': 'text/turtle' }, body: quickBuffer(putPolicy95e) });
    console.log(`expecting Policy header to mistakenly contain the new policies: ${response.status}\n${await response.text()}`);

    response = await fetch(endpoint(`/${encoded}`), { headers: { 'Authorization': client('b') } });
    console.log(`expecting to stay the same as before ${policyId95e}`, await response.text());

}

async function patchPolicies() {
    console.log("Simple test for the PATCH policy endpoint");
    const encoded1 = encodeURIComponent(policyId1);
    const encoded95e = encodeURIComponent(policyId95e);

    let response = await fetch(endpoint(`/${encoded1}`), { method: 'PATCH', headers: { 'Authorization': client('a'), 'Content-Type': 'application/sparql-update' }, body: quickBuffer(changePolicy1) });
    console.log(`expecting a positive response: status code ${response.status}`);
    testCode(response.status);
    response = await fetch(endpoint(`/${encoded1}`), { headers: { 'Authorization': client('a') }});
    let resText = await response.text();
    console.log(`expecting to see permission100 as its only rule: \n${resText}`);
    if (resText.length === 0) {
      errorCounter++;
      console.log('missing expected body');
    }

    response = await fetch(endpoint(`/${encoded95e}`), { method: 'PATCH', headers: { 'Authorization': client('a'), 'Content-Type': 'application/sparql-update' }, body: quickBuffer(changePolicy95e) });
    console.log(`expecting a positive response: status code ${response.status}`);
    testCode(response.status);
    response = await fetch(endpoint(`/${encoded95e}`), { headers: { 'Authorization': client('a') }});
    resText = await response.text();
    console.log(`expecting the old rule to delete and two rules to take its place: \n${resText}`);
    if (resText.length === 0) {
        errorCounter++;
        console.log('missing expected body');
    }

    response = await fetch(endpoint(`/${encoded1}`), { method: 'PATCH', headers: { 'Authorization': client('c'), 'Content-Type': 'application/sparql-update' }, body: quickBuffer(changePolicy1) });
    console.log(`expecting a negative response since the query changes another client's rules ${response.status}\nmessage: ${await response.text()}`);
    testCode(response.status, 4);

    response = await fetch(endpoint(), { headers: { 'Authorization': client('a') } })
    resText = await response.text();
    console.log("expecting to see the patched policy for client a: \n", resText)
    testCode(response.status);
    if (resText.length === 0) {
        errorCounter++;
        console.log('missing expected body');
    }
}

async function getAllPolicies() {
    console.log("Simple test for the GET All Policies endpoint\n");

    let response = await fetch(endpoint(), { headers: { 'Authorization': client('a') } })
    console.log("expecting policy 1, 1a and <urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc>: \n", await response.text())
    testCode(response.status);

    response = await fetch(endpoint(), { headers: { 'Authorization': client('b') } })
    console.log("expecting policy 2, 2a and <urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc>: \n", await response.text())
    testCode(response.status);

    response = await fetch(endpoint(), {});
    console.log(`expecting 4xx error code (no authorization header provided): ${response.status}`)
    testCode(response.status, 4);
}

async function getOnePolicy() {
    console.log("Simple test for the GET One Policy endpoint");

    const encoded = encodeURIComponent(policyId1);

    let response = await fetch(endpoint(`/${encoded}`), { headers: { 'Authorization': client('a') } });
    console.log(`expecting to return relevent information about ${policyId1}`, await response.text());

    response = await fetch(endpoint(`/${badPolicyId}`), { headers: { 'Authorization': client('b') } });
    let resText = await response.text();
    console.log(`expecting an empty body, the policy ID does not exist: ${resText}`);
    testCode(resText.length, 0, false);

    response = await fetch(endpoint(`/${encoded}`), { headers: { 'Authorization': client('c') } });
    resText = await response.text();
    console.log(`expecting an empty body, the client is not authorized: ${resText}`);
    testCode(resText.length, 0, false);
}

async function postPolicy() {
    console.log("Simple test for the POST policy endpoint");

    let response = await fetch(endpoint(), { method: 'POST', headers: { 'Authorization': client('a'), 'Content-Type': 'text/turtle' }, body: quickBuffer(policyB) });
    console.log(`expecting a negative response since assigner != client: status code ${response.status}\nmessage: ${await response.text()}`);
    testCode(response.status, 4);

    response = await fetch(endpoint(), { method: 'POST', headers: { 'Authorization': client('b'), 'Content-Type': 'text/turtle' }, body: quickBuffer(badPolicy1) });
    console.log(`expecting a negative response since policy has a rule with no assigner ${response.status}\nmessage: ${await response.text()}`);
    testCode(response.status, 4);

    response = await fetch(endpoint(), { method: 'POST', headers: { 'Authorization': client('a'), 'Content-Type': 'text/turtle' }, body: quickBuffer(policyA) });
    console.log(`expecting a positive response: status code ${response.status}, ${await response.text()}`);
    testCode(response.status);

    response = await fetch(endpoint(), { method: 'POST', headers: { 'Authorization': client('b'), 'Content-Type': 'text/turtle' }, body: quickBuffer(policyB) });
    console.log(`expecting a positive response: status code ${response.status}, ${await response.text()}`);
    testCode(response.status);

    response = await fetch(endpoint(), { method: 'POST', headers: { 'Authorization': client('c'), 'Content-Type': 'text/turtle' }, body: quickBuffer(policyC) });
    console.log(`expecting a positive response: status code ${response.status}, ${await response.text()}`);
    testCode(response.status);
}

async function testDelete() {
    const encodedPolicyId = encodeURIComponent(policyId95e);
    console.log("Testing Delete endpoint");

    let response = await fetch(endpoint(`/${encodedPolicyId}`), { method: 'DELETE', headers: { 'Authorization': client('c') } });
    console.log(`expecting status 204, nothing to delete: ${response.status}`);
    testCode(response.status, 204, false);

    response = await fetch(endpoint(`/${encodedPolicyId}`), { method: 'DELETE', headers: { 'Authorization': client('a') } });
    console.log(`expecting status 204: ${response.status}\n`);
    testCode(response.status, 204, false);

    console.log('testing if the policy is deleted for client a, but not for client b\n');
    response = await fetch(endpoint(`/${encodedPolicyId}`), { headers: { 'Authorization': client('a') } });
    let resText = await response.text();
    console.log(`expecting an empty body, the policy should be deleted for client a: ${resText}`);
    testCode(resText.length, 0, false);

    response = await fetch(endpoint(`/${encodedPolicyId}`), { headers: { 'Authorization': client('b') } });
    testCode(response.status, 200, false);
    resText = await response.text();
    console.log(`expecting the policy with one rule: ${resText}\n`);
    if (resText.length === 0) {
      errorCounter++;
      console.log('missing expected body');
    }

    console.log('\nnow we delete the policy for client b. It should delete the rules AND the policy information');
    response = await fetch(endpoint(`/${encodedPolicyId}`), { method: 'DELETE', headers: { 'Authorization': client('b') } });
    console.log(`expecting status 204: ${response.status}`);
    testCode(response.status, 204, false);
    response = await fetch(endpoint(`/${encodedPolicyId}`), { headers: { 'Authorization': client('a') } });
    resText = await response.text();
    console.log(`expecting an empty body, the policy should be deleted for client a: ${resText}`);
    testCode(resText.length, 0, false);
}

async function furtherSeeding() {
    // Due to new POST implementation, client B must PUT its own rules into existing policy `policy95e`
    const response = await fetch(endpoint(`/${encodeURIComponent(policyId95e)}`), { method: 'PUT', headers: { 'Authorization': client('b'), 'Content-Type': 'text/turtle' }, body: quickBuffer(putPolicyB) });
    console.log(`expecting Policy header to mistakenly contain the new policies: ${response.status}\n${await response.text()}`);
}

async function deleteAll() {
    const obj = {
        'a': ['http://example.org/usagePolicy1', 'http://example.org/usagePolicy1a', 'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc'],
        'b': ['http://example.org/usagePolicy2', 'http://example.org/usagePolicy2a', 'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc'], 'c': ['http://example.org/usagePolicy3']
    }
    console.log("deleting all policies")
    for (const [clientId, policyIds] of Object.entries(obj)) {
        for (const policyId of policyIds) {
            const response = await fetch(endpoint(`/${encodeURIComponent(policyId)}`), { method: 'DELETE', headers: { 'Authorization': client(clientId) } })
            console.log(`DELETE ${policyId} from client ${clientId} responded with status ${response.status}`)
        }
    }
}

/**
 * As explained in the docs, the order of execution is extremely important.
 * The storage is filled with the POST requests, so this must precede the other tests!
 */
async function main() {
    errorCounter = 0;
    console.log("Testing all implemented Policy Endpoints:\n\n\n");
    await postPolicy();
    await furtherSeeding();
    console.log("\n\n\n");
    await getAllPolicies();
    console.log("\n\n\n");
    await getOnePolicy();
    console.log("\n\n\n");
    await patchPolicies();
    console.log("\n\n\n");
    await testDelete();
    console.log("\n\n\n");
    await putPolicies();
    console.log("\n\n\n");
    await deleteAll()
    console.log("\n\n\n");

    console.log(errorCounter === 0 ? `No fails detected` : `${errorCounter} tests have failed`);
}
main()
