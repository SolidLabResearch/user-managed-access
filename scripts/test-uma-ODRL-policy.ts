/**
 * This test requires the ODRL Authorization Server to be running.
 * 
 * The purpose of this file is to test the /policies endpoint.
 */

const endpoint = (extra: string = '') => 'http://localhost:4000/uma/policies' + extra;
const client1 = 'https://pod.woutslabbinck.com/profile/card#me';
const client2 = 'https://pod.example.com/profile/card#me';
const policyId = 'ex:usagePolicy1';
const badPolicyId = 'nonExistentPolicy';
const policyBody = "@prefix ex: <http://example.org/>.\n@prefix odrl: <http://www.w3.org/ns/odrl/2/> .\nex:usagePolicy4 a odrl:Agreement .\nex:usagePolicy4 odrl:permission ex:permission4 .\nex:permission4 a odrl:Permission .\nex:permission4 odrl:action odrl:read .\nex:permission4 odrl:target <http://localhost:3000/alice/other/resource.txt> .\nex:permission4 odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .\nex:permission4 odrl:assigner <https://pod.example.com/profile/card#me> .";

async function getAllPolicies() {
    console.log("Simple test for the GET All Policies endpoint\n");

    let response = await fetch(endpoint(), { headers: { 'Authorization': client1 } })
    console.log("expecting all five policies and their relations: \n", await response.text())

    response = await fetch(endpoint(), { headers: { 'Authorization': client2 } })
    console.log("expecting zero policies: ", await response.text())

    response = await fetch(endpoint(), {});
    console.log(`expecting 4xx error code (no authorization header provided): ${response.status}`)
}

async function getOnePolicy() {
    console.log("Simple test for the GET One Policy endpoint");

    let response = await fetch(endpoint(`/${policyId}`), { headers: { 'Authorization': client1 } });
    console.log(`expecting to return relevent information about ${policyId}`, await response.text());

    response = await fetch(endpoint(`/${badPolicyId}`), { headers: { 'Authorization': client1 } });
    console.log(`expecting 4xx error code since the policy ID is not valid`)

    response = await fetch(endpoint(`/${policyId}`), { headers: { 'Authorization': client2 } });
    console.log(`expecting 4xx error code since the client is not authorized to access the policy`)
}

async function postPolicy() {
    console.log("Simple test for the POST policy endpoint");

    let response = await fetch(endpoint(), { method: 'POST', headers: { 'Authorization': client1, 'Content-Type': 'application/json' }, body: JSON.stringify({ policy: policyBody }) });
    console.log(`expecting a negative response since assigner != client: status code ${response.status}`);

    response = await fetch(endpoint(), { method: 'POST', headers: { 'Authorization': client2, 'Content-Type': 'application/json' }, body: JSON.stringify({ policy: policyBody }) });
    console.log(`expecting a positive response: status code ${response.status}`);
}

async function main() {
    await getAllPolicies();
    //await getOnePolicy(); awaiting implementation
    await postPolicy();
}
main()
