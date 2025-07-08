/**
 * This test requires the ODRL Authorization Server to be running.
 * 
 * The purpose of this file is to test the /policies endpoint.
 */

import { policyA, policyB, policyC, badPolicy1 } from "./util/policyExampels";

const endpoint = (extra: string = '') => 'http://localhost:4000/uma/policies' + extra;
const client = (client: string = 'a') => `https://pod.${client}.com/profile/card#me`;
const policyId = 'http://example.org/usagePolicy1';
const badPolicyId = 'nonExistentPolicy';


async function getAllPolicies() {
    console.log("Simple test for the GET All Policies endpoint\n");

    let response = await fetch(endpoint(), { headers: { 'Authorization': client('a') } })
    console.log("expecting policy 1, 1a and <urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc>: \n", await response.text())

    response = await fetch(endpoint(), { headers: { 'Authorization': client('b') } })
    console.log("expecting policy 2, 2a and <urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc>: \n", await response.text())

    response = await fetch(endpoint(), {});
    console.log(`expecting 4xx error code (no authorization header provided): ${response.status}`)
}

async function getOnePolicy() {
    console.log("Simple test for the GET One Policy endpoint");

    const encoded = encodeURIComponent(policyId);

    let response = await fetch(endpoint(`/${encoded}`), { headers: { 'Authorization': client('a') } });
    console.log(`expecting to return relevent information about ${policyId}`, await response.text());

    response = await fetch(endpoint(`/${badPolicyId}`), { headers: { 'Authorization': client('b') } });
    console.log(`expecting an empty body, the policy ID does not exist: ${await response.text()}`);

    response = await fetch(endpoint(`/${encoded}`), { headers: { 'Authorization': client('c') } });
    console.log(`expecting an empty body, the client is not authorized: ${await response.text()}`);
}

async function postPolicy() {
    console.log("Simple test for the POST policy endpoint");

    let response = await fetch(endpoint(), { method: 'POST', headers: { 'Authorization': client('a'), 'Content-Type': 'text/turtle' }, body: Buffer.from(policyB, 'utf-8') });
    console.log(`expecting a negative response since assigner != client: status code ${response.status}\nmessage: ${await response.text()}`);

    response = await fetch(endpoint(), { method: 'POST', headers: { 'Authorization': client('b'), 'Content-Type': 'text/turtle' }, body: Buffer.from(badPolicy1, 'utf-8') });
    console.log(`expecting a negative response since policy has a rule with no assigner ${response.status}\nmessage: ${await response.text()}`);

    response = await fetch(endpoint(), { method: 'POST', headers: { 'Authorization': client('a'), 'Content-Type': 'text/turtle' }, body: Buffer.from(policyA, 'utf-8') });
    console.log(`expecting a positive response: status code ${response.status}, ${await response.text()}`);

    response = await fetch(endpoint(), { method: 'POST', headers: { 'Authorization': client('b'), 'Content-Type': 'text/turtle' }, body: Buffer.from(policyB, 'utf-8') });
    console.log(`expecting a positive response: status code ${response.status}, ${await response.text()}`);

    response = await fetch(endpoint(), { method: 'POST', headers: { 'Authorization': client('c'), 'Content-Type': 'text/turtle' }, body: Buffer.from(policyC, 'utf-8') });
    console.log(`expecting a positive response: status code ${response.status}, ${await response.text()}`);
}
async function main() {
    console.log("Testing all implemented Policy Endpoints:\n\n\n");
    await postPolicy();
    console.log("\n\n\n");
    await getAllPolicies();
    console.log("\n\n\n");
    await getOnePolicy();
    console.log("\n\n\n");
}
main()
