/**
 * This test requires the ODRL Authorization Server to be running.
 * 
 * The purpose of this file is to test the /policies endpoint.
 */

import path from "path";
import { DirectoryUCRulesStorage } from "../packages/ucp/src/storage/DirectoryUCRulesStorage"
import { PolicyRequestHandler } from "../packages/uma/src/routes/Policy"

const endpoint = 'http://localhost:4000/uma/policies'
const client1 = 'https://pod.woutslabbinck.com/profile/card#me';
const client2 = 'https://pod.example.com/profile/card#me';

// Pathname for the test-policy directory, will probably be changed with the new test structure
const policyStorePath = path.join(__dirname, '..', 'packages', 'uma', 'config', 'rules', 'test');

async function testGetAllPolicies() {
    console.log("\n\nTest GET all policies endpoint",);

    let response = await fetch(endpoint, { headers: { 'Authorization': client1 } });

    console.log("expecting all five policies and their relations: \n", await response.text());

    response = await fetch(endpoint, { headers: { 'Authorization': client2 } });

    console.log("expecting zero policies: ", await response.text());

    response = await fetch(endpoint, {});

    console.log(`expecting 4xx error code (no authorization header provided): ${response.status}`);

    // Manual test for specific test cases
    // This test uses the existing test.ttl policy directory as the store, could be any other store
    const store = new DirectoryUCRulesStorage(policyStorePath);
    const handler = new PolicyRequestHandler(store);

    let res = await handler.handle({ request: { url: new URL("http://localhost:4000/uma/policies"), method: 'GET', headers: { 'authorization': "https://pod.a.com/profile/card#me" } } });
    console.log("expecting only policy 1: ", res.body);
}

async function main() {
    console.log(`Primitive unit test to check policy access based on the client\n`);

    await testGetAllPolicies();

}
main()
