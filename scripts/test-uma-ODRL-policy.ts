/**
 * This test requires the ODRL Authorization Server to be running.
 * 
 * The purpose of this file is to test the /policies endpoint.
 */

const endpoint = (extra: string = '') => 'http://localhost:4000/uma/policies' + extra;
const client = (client: string = 'a') => `https://pod.${client}.com/profile/card#me`;
const policyId = 'http://example.org/usagePolicy1';
const badPolicyId = 'nonExistentPolicy';
const policyA = `
@prefix ex: <http://example.org/> .
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix dct: <http://purl.org/dc/terms/> .

ex:usagePolicy1 a odrl:Agreement .
ex:usagePolicy1 odrl:permission ex:permission1 .
ex:permission1 a odrl:Permission .
ex:permission1 odrl:action odrl:modify .
ex:permission1 odrl:target <http://localhost:3000/alice/other/resource.txt> .
ex:permission1 odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .
ex:permission1 odrl:assigner <https://pod.a.com/profile/card#me> .

ex:usagePolicy1a a odrl:Agreement .
ex:usagePolicy1a odrl:permission ex:permission1a .
ex:permission1a a odrl:Permission .
ex:permission1a odrl:action odrl:create .
ex:permission1a odrl:target <http://localhost:3000/alice/other/resource.txt> .
ex:permission1a odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .
ex:permission1a odrl:assigner <https://pod.a.com/profile/card#me> .

<urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc> a odrl:Set;
    dct:description "A is data owner of resource X. ALICE may READ resource X.";
    odrl:permission <urn:uuid:f5199b0a-d824-45a0-bc08-1caa8d19a001> .
<urn:uuid:f5199b0a-d824-45a0-bc08-1caa8d19a001> a odrl:Permission;
    odrl:action odrl:read;
    odrl:target ex:x;
    odrl:assignee ex:alice;
    odrl:assigner <https://pod.a.com/profile/card#me>.
`;
const policyB = `@prefix ex: <http://example.org/>.
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix dct: <http://purl.org/dc/terms/>.

ex:usagePolicy2 a odrl:Agreement .
ex:usagePolicy2 odrl:permission ex:permission2a .
ex:permission2 a odrl:Permission .
ex:permission2 odrl:action odrl:modify .
ex:permission2 odrl:target <http://localhost:3000/alice/other/> .
ex:permission2 odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .
ex:permission2 odrl:assigner <https://pod.b.com/profile/card#me> .

ex:usagePolicy2a a odrl:Agreement .
ex:usagePolicy2a odrl:permission ex:permission2 .
ex:permission2a a odrl:Permission .
ex:permission2a odrl:action odrl:create .
ex:permission2a odrl:target <http://localhost:3000/alice/other/> .
ex:permission2a odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .
ex:permission2a odrl:assigner <https://pod.b.com/profile/card#me> .

<urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc> a odrl:Set;
    dct:description "ZENO is data owner of resource X. ALICE may READ resource X.";
    odrl:permission <urn:uuid:69d57d36-74e5-443c-bae5-30159b0cbd3e> .
    
<urn:uuid:69d57d36-74e5-443c-bae5-30159b0cbd3e> a odrl:Permission ;
  odrl:assignee ex:bob ;
  odrl:assigner <https://pod.b.com/profile/card#me>;
  odrl:action odrl:read ;
  odrl:target ex:x .
`;

const policyC = `@prefix ex: <http://example.org/>.
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix dct: <http://purl.org/dc/terms/>.

ex:usagePolicy3 a odrl:Agreement .
ex:usagePolicy3 odrl:permission ex:permission3 .
ex:permission3 a odrl:Permission .
ex:permission3 odrl:action odrl:read .
ex:permission3 odrl:target <http://localhost:3000/alice/other/resource.txt> .
ex:permission3 odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .
ex:permission3 odrl:assigner <https://pod.c.com/profile/card#me> .`;


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
