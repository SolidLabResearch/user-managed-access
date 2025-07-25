export const policyA = `
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
export const policyB = `@prefix ex: <http://example.org/>.
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
`;

export const putPolicyB = `
@prefix ex: <http://example.org/>.
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix dct: <http://purl.org/dc/terms/>.
<urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc> a odrl:Set;
    dct:description "ZENO is data owner of resource X. ALICE may READ resource X.";
    odrl:permission <urn:uuid:69d57d36-74e5-443c-bae5-30159b0cbd3e> .
    
<urn:uuid:69d57d36-74e5-443c-bae5-30159b0cbd3e> a odrl:Permission ;
  odrl:assignee ex:bob ;
  odrl:assigner <https://pod.b.com/profile/card#me>;
  odrl:action odrl:read ;
  odrl:target ex:x .`;

export const policyC = `@prefix ex: <http://example.org/>.
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix dct: <http://purl.org/dc/terms/>.

ex:usagePolicy3 a odrl:Agreement .
ex:usagePolicy3 odrl:permission ex:permission3 .
ex:permission3 a odrl:Permission .
ex:permission3 odrl:action odrl:read .
ex:permission3 odrl:target <http://localhost:3000/alice/other/resource.txt> .
ex:permission3 odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .
ex:permission3 odrl:assigner <https://pod.c.com/profile/card#me> .`;

export const badPolicy1 = `
@prefix ex: <http://example.org/>.
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix dct: <http://purl.org/dc/terms/>.

ex:usagePolicyBad a odrl:Agreement .
ex:usagePolicyBad odrl:permission ex:permissionBad .
ex:permissionBad a odrl:Permission .
ex:permissionBad odrl:action odrl:modify .
ex:permissionBad odrl:target <http://localhost:3000/alice/other/> .
ex:permissionBad odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .
`

export const changePolicy1 = `
PREFIX ex: <http://example.org/>
PREFIX odrl: <http://www.w3.org/ns/odrl/2/>
PREFIX dct: <http://purl.org/dc/terms/>

DELETE {
  ex:usagePolicy1 odrl:permission ex:permission1 .
  ex:permission1 a odrl:Permission ;
                 odrl:action odrl:modify ;
                 odrl:target <http://localhost:3000/alice/other/resource.txt> ;
                 odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> ;
                 odrl:assigner <https://pod.a.com/profile/card#me> .
}
INSERT {
  ex:usagePolicy1 odrl:permission ex:permission100 .
  ex:permission100 a odrl:Permission ;
                 odrl:action odrl:read ;
                 odrl:target <http://localhost:3000/alice/other/resource.txt> ;
                 odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> ;
                 odrl:assigner <https://pod.a.com/profile/card#me> .
}
WHERE {
  ex:usagePolicy1 odrl:permission ex:permission1 .
  ex:permission1 a odrl:Permission ;
                 odrl:action odrl:modify ;
                 odrl:target <http://localhost:3000/alice/other/resource.txt> ;
                 odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> ;
                 odrl:assigner <https://pod.a.com/profile/card#me> .
}
`

export const changePolicy95e = `
PREFIX ex: <http://example.org/>
PREFIX odrl: <http://www.w3.org/ns/odrl/2/>
PREFIX dct: <http://purl.org/dc/terms/>

DELETE {
  <urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc> odrl:permission <urn:uuid:f5199b0a-d824-45a0-bc08-1caa8d19a001> .
  <urn:uuid:f5199b0a-d824-45a0-bc08-1caa8d19a001> ?p ?o .
}
INSERT {
  <urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc> odrl:permission <urn:uuid:a1111111-2222-3333-4444-555555555555> .
  <urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc> odrl:permission <urn:uuid:b6666666-7777-8888-9999-aaaaaaaaaaaa> .

  <urn:uuid:a1111111-2222-3333-4444-555555555555> a odrl:Permission ;
    odrl:assignee ex:alice ;
    odrl:assigner <https://pod.a.com/profile/card#me> ;
    odrl:action odrl:write ;
    odrl:target ex:x .

  <urn:uuid:b6666666-7777-8888-9999-aaaaaaaaaaaa> a odrl:Permission ;
    odrl:assignee ex:alice ;
    odrl:assigner <https://pod.a.com/profile/card#me> ;
    odrl:action odrl:delete ;
    odrl:target ex:x .
}
WHERE {
  OPTIONAL {
    <urn:uuid:f5199b0a-d824-45a0-bc08-1caa8d19a001> ?p ?o .
  }
}
`

export const putPolicy95e = `
<urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc> a <http://www.w3.org/ns/odrl/2/Set>;
    <http://purl.org/dc/terms/description> "ZENO is data owner of resource X. ALICE may READ resource X.";
    <http://www.w3.org/ns/odrl/2/permission> <urn:uuid:a1111111-2222-3333-4444-555555555555>, <urn:uuid:b6666666-7777-8888-9999-aaaaaaaaaaaa>.
<urn:uuid:a1111111-2222-3333-4444-555555555555> a <http://www.w3.org/ns/odrl/2/Permission>;
    <http://www.w3.org/ns/odrl/2/assignee> <http://example.org/alice>;
    <http://www.w3.org/ns/odrl/2/assigner> <https://pod.a.com/profile/card#me>;
    <http://www.w3.org/ns/odrl/2/action> <http://www.w3.org/ns/odrl/2/write>;
    <http://www.w3.org/ns/odrl/2/target> <http://example.org/x>.
<urn:uuid:b6666666-7777-8888-9999-aaaaaaaaaaaa> a <http://www.w3.org/ns/odrl/2/Permission>;
    <http://www.w3.org/ns/odrl/2/assignee> <http://example.org/alice>;
    <http://www.w3.org/ns/odrl/2/assigner> <https://pod.a.com/profile/card#me>;
    <http://www.w3.org/ns/odrl/2/action> <http://www.w3.org/ns/odrl/2/delete>;
    <http://www.w3.org/ns/odrl/2/target> <http://example.org/x>.
`

export const seedingPolicies = (id: string) => `
@prefix ex: <http://example.org/> .
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix dct: <http://purl.org/dc/terms/> .

ex:usagePolicy1 a odrl:Agreement .
ex:usagePolicy1 odrl:permission ex:permission1 .
ex:permission1 a odrl:Permission .
ex:permission1 odrl:action odrl:read .
ex:permission1 odrl:action odrl:write .
ex:permission1 odrl:action odrl:append .
ex:permission1 odrl:target <http://localhost:3000/alice/other/oneFile.txt> .
ex:permission1 odrl:assignee <https://some.other.subject/profile/card#me> .
ex:permission1 odrl:assigner <${id}> .

ex:usagePolicy1a a odrl:Agreement .
ex:usagePolicy1a odrl:permission ex:permission1a .
ex:permission1a a odrl:Permission .
ex:permission1a odrl:action odrl:control .
ex:permission1a odrl:target <http://localhost:3000/alice/other/otherFile.txt> .
ex:permission1a odrl:assignee <https://some.other.subject/profile/card#me> .
ex:permission1a odrl:assignee <https://another.random.subject/profile/card#me> .
ex:permission1a odrl:assigner <${id}> .

<urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc> a odrl:Set;
    dct:description "A is data owner of resource X. ALICE may READ resource X.";
    odrl:permission <urn:uuid:f5199b0a-d824-45a0-bc08-1caa8d19a001> .
<urn:uuid:f5199b0a-d824-45a0-bc08-1caa8d19a001> a odrl:Permission;
    odrl:action odrl:read;
    odrl:action odrl:append;
    odrl:action odrl:write;
    odrl:target ex:x;
    odrl:assignee ex:alice;
    odrl:assigner <${id}>.

ex:usagePolicy3 a odrl:Agreement .
ex:usagePolicy3 odrl:permission ex:permission3 .
ex:permission3 a odrl:Permission .
ex:permission3 odrl:action odrl:create .
ex:permission3 odrl:target <http://localhost:3000/alice/other/resource.txt> .
ex:permission3 odrl:assignee <https://assignee/profile/card#me> .
ex:permission3 odrl:assigner <${id}> .

ex:usagePolicy3 odrl:permission ex:permission3b .
ex:permission3b a odrl:Permission .
ex:permission3b odrl:action odrl:create .
ex:permission3b odrl:action odrl:read .
ex:permission3b odrl:action odrl:write .
ex:permission3b odrl:action odrl:control .
ex:permission3b odrl:target <http://localhost:3000/alice/other/resource.txt> .
ex:permission3b odrl:assigner <${id}> .

`

export const seedingPolicies2 = (id: string) => `
@prefix ex: <http://example.org/> .
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix dct: <http://purl.org/dc/terms/> .

ex:usagePolicy1-read a odrl:Agreement .
ex:usagePolicy1-read odrl:permission ex:permission1-read .
ex:permission1-read a odrl:Permission .
ex:permission1-read odrl:action odrl:read .
ex:permission1-read odrl:target <http://localhost:3000/alice/other/oneFile.txt> .
ex:permission1-read odrl:assignee <https://some.other.subject/profile/card#me> .
ex:permission1-read odrl:assigner <${id}> .

ex:usagePolicy1-write a odrl:Agreement .
ex:usagePolicy1-write odrl:permission ex:permission1-write .
ex:permission1-write a odrl:Permission .
ex:permission1-write odrl:action odrl:write .
ex:permission1-write odrl:target <http://localhost:3000/alice/other/oneFile.txt> .
ex:permission1-write odrl:assignee <https://some.other.subject/profile/card#me> .
ex:permission1-write odrl:assigner <${id}> .

ex:usagePolicy1-append a odrl:Agreement .
ex:usagePolicy1-append odrl:permission ex:permission1-append .
ex:permission1-append a odrl:Permission .
ex:permission1-append odrl:action odrl:append .
ex:permission1-append odrl:target <http://localhost:3000/alice/other/oneFile.txt> .
ex:permission1-append odrl:assignee <https://some.other.subject/profile/card#me> .
ex:permission1-append odrl:assigner <${id}> .

ex:usagePolicy1a-control-1 a odrl:Agreement .
ex:usagePolicy1a-control-1 odrl:permission ex:permission1a-control-1 .
ex:permission1a-control-1 a odrl:Permission .
ex:permission1a-control-1 odrl:action odrl:control .
ex:permission1a-control-1 odrl:target <http://localhost:3000/alice/other/otherFile.txt> .
ex:permission1a-control-1 odrl:assignee <https://some.other.subject/profile/card#me> .
ex:permission1a-control-1 odrl:assigner <${id}> .

ex:usagePolicy1a-control-2 a odrl:Agreement .
ex:usagePolicy1a-control-2 odrl:permission ex:permission1a-control-2 .
ex:permission1a-control-2 a odrl:Permission .
ex:permission1a-control-2 odrl:action odrl:control .
ex:permission1a-control-2 odrl:target <http://localhost:3000/alice/other/otherFile.txt> .
ex:permission1a-control-2 odrl:assignee <https://another.random.subject/profile/card#me> .
ex:permission1a-control-2 odrl:assigner <${id}> .

<urn:uuid:policy-read> a odrl:Set;
    dct:description "A is data owner of resource X. ALICE may READ resource X.";
    odrl:permission <urn:uuid:perm-read> .
<urn:uuid:perm-read> a odrl:Permission;
    odrl:action odrl:read;
    odrl:target ex:x;
    odrl:assignee ex:alice;
    odrl:assigner <${id}> .

<urn:uuid:policy-append> a odrl:Set;
    odrl:permission <urn:uuid:perm-append> .
<urn:uuid:perm-append> a odrl:Permission;
    odrl:action odrl:append;
    odrl:target ex:x;
    odrl:assignee ex:alice;
    odrl:assigner <${id}> .

<urn:uuid:policy-write> a odrl:Set;
    odrl:permission <urn:uuid:perm-write> .
<urn:uuid:perm-write> a odrl:Permission;
    odrl:action odrl:write;
    odrl:target ex:x;
    odrl:assignee ex:alice;
    odrl:assigner <${id}> .

ex:usagePolicy3-create a odrl:Agreement .
ex:usagePolicy3-create odrl:permission ex:permission3-create .
ex:permission3-create a odrl:Permission .
ex:permission3-create odrl:action odrl:create .
ex:permission3-create odrl:target <http://localhost:3000/alice/other/resource.txt> .
ex:permission3-create odrl:assignee <https://assignee/profile/card#me> .
ex:permission3-create odrl:assigner <${id}> .

ex:usagePolicy3b-create a odrl:Agreement .
ex:usagePolicy3b-create odrl:permission ex:permission3b-create .
ex:permission3b-create a odrl:Permission .
ex:permission3b-create odrl:action odrl:create .
ex:permission3b-create odrl:target <http://localhost:3000/alice/other/resource.txt> .
ex:permission3b-create odrl:assigner <${id}> .

ex:usagePolicy3b-read a odrl:Agreement .
ex:usagePolicy3b-read odrl:permission ex:permission3b-read .
ex:permission3b-read a odrl:Permission .
ex:permission3b-read odrl:action odrl:read .
ex:permission3b-read odrl:target <http://localhost:3000/alice/other/resource.txt> .
ex:permission3b-read odrl:assigner <${id}> .

ex:usagePolicy3b-write a odrl:Agreement .
ex:usagePolicy3b-write odrl:permission ex:permission3b-write .
ex:permission3b-write a odrl:Permission .
ex:permission3b-write odrl:action odrl:write .
ex:permission3b-write odrl:target <http://localhost:3000/alice/other/resource.txt> .
ex:permission3b-write odrl:assigner <${id}> .

ex:usagePolicy3b-control a odrl:Agreement .
ex:usagePolicy3b-control odrl:permission ex:permission3b-control .
ex:permission3b-control a odrl:Permission .
ex:permission3b-control odrl:action odrl:control .
ex:permission3b-control odrl:target <http://localhost:3000/alice/other/resource.txt> .
ex:permission3b-control odrl:assigner <${id}> .
`
