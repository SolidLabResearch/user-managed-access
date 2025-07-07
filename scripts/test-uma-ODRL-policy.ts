/**
 * This test requires the ODRL Authorization Server to be running.
 * 
 * The purpose of this file is to test the /policies endpoint.
 */

const endpoint = (extra: string = '') => 'http://localhost:4000/uma/policies' + extra;
const client1 = 'https://pod.woutslabbinck.com/profile/card#me';
const client2 = 'https://pod.example.com/profile/card#me';
const policyId = 'http://example.org/usagePolicy1';
const badPolicyId = 'nonExistentPolicy';
const policyBody = "@prefix ex: <http://example.org/>.\n@prefix odrl: <http://www.w3.org/ns/odrl/2/> .\nex:usagePolicy4 a odrl:Agreement .\nex:usagePolicy4 odrl:permission ex:permission4 .\nex:permission4 a odrl:Permission .\nex:permission4 odrl:action odrl:read .\nex:permission4 odrl:target <http://localhost:3000/alice/other/resource.txt> .\nex:permission4 odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .\nex:permission4 odrl:assigner <https://pod.example.com/profile/card#me> .";
const seed = "@prefix ex: <http://example.org/>.\r\n@prefix odrl: <http://www.w3.org/ns/odrl/2/> .\r\n@prefix dct: <http://purl.org/dc/terms/>.\r\n\r\nex:usagePolicy1 a odrl:Agreement .\r\nex:usagePolicy1 odrl:permission ex:permission1 .\r\nex:permission1 a odrl:Permission .\r\nex:permission1 odrl:action odrl:modify .\r\nex:permission1 odrl:target <http://localhost:3000/alice/other/resource.txt> .\r\nex:permission1 odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .\r\nex:permission1 odrl:assigner <https://pod.woutslabbinck.com/profile/card#me> .\r\n\r\nex:usagePolicy1a a odrl:Agreement .\r\nex:usagePolicy1a odrl:permission ex:permission1a .\r\nex:permission1a a odrl:Permission .\r\nex:permission1a odrl:action odrl:create .\r\nex:permission1a odrl:target <http://localhost:3000/alice/other/resource.txt> .\r\nex:permission1a odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .\r\nex:permission1a odrl:assigner <https://pod.example.com/profile/card#me> .\r\n\r\nex:usagePolicy2 a odrl:Agreement .\r\nex:usagePolicy2 odrl:permission ex:permission2a .\r\nex:permission2 a odrl:Permission .\r\nex:permission2 odrl:action odrl:modify .\r\nex:permission2 odrl:target <http://localhost:3000/alice/other/> .\r\nex:permission2 odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .\r\nex:permission2 odrl:assigner <https://pod.woutslabbinck.com/profile/card#me> .\r\n\r\nex:usagePolicy2a a odrl:Agreement .\r\nex:usagePolicy2a odrl:permission ex:permission2 .\r\nex:permission2a a odrl:Permission .\r\nex:permission2a odrl:action odrl:create .\r\nex:permission2a odrl:target <http://localhost:3000/alice/other/> .\r\nex:permission2a odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .\r\nex:permission2a odrl:assigner <https://pod.example.com/profile/card#me> .\r\n\r\n\r\nex:usagePolicy3 a odrl:Agreement .\r\nex:usagePolicy3 odrl:permission ex:permission3 .\r\nex:permission3 a odrl:Permission .\r\nex:permission3 odrl:action odrl:read .\r\nex:permission3 odrl:target <http://localhost:3000/alice/other/resource.txt> .\r\nex:permission3 odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .\r\nex:permission3 odrl:assigner <https://pod.woutslabbinck.com/profile/card#me> .\r\n\r\n<urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc> a odrl:Set;\r\n    dct:description \"ZENO is data owner of resource X. ALICE may READ resource X.\";\r\n    odrl:permission <urn:uuid:f5199b0a-d824-45a0-bc08-1caa8d19a001>,<urn:uuid:69d57d36-74e5-443c-bae5-30159b0cbd3e> .\r\n<urn:uuid:f5199b0a-d824-45a0-bc08-1caa8d19a001> a odrl:Permission;\r\n    odrl:action odrl:read;\r\n    odrl:target ex:x;\r\n    odrl:assignee ex:alice;\r\n    odrl:assigner ex:zeno.\r\n    \r\n<urn:uuid:69d57d36-74e5-443c-bae5-30159b0cbd3e> a odrl:Permission ;\r\n  odrl:assignee ex:bob ;\r\n  odrl:assigner ex:wout;\r\n  odrl:action odrl:read ;\r\n  odrl:target ex:x ."

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

    const encoded = encodeURI(policyId);

    let response = await fetch(endpoint(`/${encoded}`), { headers: { 'Authorization': client1 } });
    console.log(`expecting to return relevent information about ${policyId}`, await response.text());

    response = await fetch(endpoint(`/${badPolicyId}`), { headers: { 'Authorization': client1 } });
    console.log(`expecting 4xx error code since the policy ID is not valid: ${response.status}`)

    response = await fetch(endpoint(`/${encoded}`), { headers: { 'Authorization': client2 } });
    console.log(`expecting 4xx error code since the client is not authorized to access the policy: ${response.status}`)
}

async function postPolicy() {
    console.log("Simple test for the POST policy endpoint");

    let response = await fetch(endpoint(), { method: 'POST', headers: { 'Authorization': client1, 'Content-Type': 'application/json' }, body: JSON.stringify({ policy: policyBody }) });
    console.log(`expecting a negative response since assigner != client: status code ${response.status}\nmessage: ${await response.text()}`);

    response = await fetch(endpoint(), { method: 'POST', headers: { 'Authorization': client2, 'Content-Type': 'application/json' }, body: JSON.stringify({ policy: seed }) });
    console.log(`expecting a positive response: status code ${response.status}, ${await response.text()}`);
}

const typeCheck = ((contentType: string): boolean => {
    return (/(?:n3|trig|turtle|nquads?|ntriples?)$/i.test(contentType))
})

async function main() {
    console.log(typeCheck('text/turtle'))
    // console.log("Testing all implemented Policy Endpoints:\n\n\n");
    // await postPolicy();
    // console.log("\n\n\n");
    // await getAllPolicies();
    // console.log("\n\n\n");
    // await getOnePolicy();
    // console.log("\n\n\n");
}
main()
