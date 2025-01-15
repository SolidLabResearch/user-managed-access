import {OdrlAuthorizer} from "../../src/policies/authorizers/OdrlAuthorizer";
import {turtleStringToStore} from "odrl-evaluator";
import {Store} from "n3";
import {MemoryUCRulesStorage, UCRulesStorage} from "@solidlab/ucp";
import {ClaimSet} from "../../src/credentials/ClaimSet";
import {Permission} from "../../src/views/Permission";
import {Authorizer} from "../../src/policies/authorizers/Authorizer";

const resourceModifyPolicy = `
@prefix ex: <http://example.org/>.
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .

ex:usagePolicy1 a odrl:Agreement .
ex:usagePolicy1 odrl:permission ex:permission1 .
ex:permission1 a odrl:Permission .
ex:permission1 odrl:action odrl:modify .
ex:permission1 odrl:target <http://localhost:3000/alice/other/resource.txt> .
ex:permission1 odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .
ex:permission1 odrl:assigner <https://pod.woutslabbinck.com/profile/card#me> .
`;

const resourceCreatePolicy = `
@prefix ex: <http://example.org/>.
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
ex:usagePolicy1a a odrl:Agreement .
ex:usagePolicy1a odrl:permission ex:permission1a .
ex:permission1a a odrl:Permission .
ex:permission1a odrl:action odrl:create .
ex:permission1a odrl:target <http://localhost:3000/alice/other/resource.txt> .
ex:permission1a odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .
ex:permission1a odrl:assigner <https://pod.woutslabbinck.com/profile/card#me> .
`

const containerModifyPolicy = `
@prefix ex: <http://example.org/>.
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
ex:usagePolicy2 a odrl:Agreement .
ex:usagePolicy2 odrl:permission ex:permission2a .
ex:permission2 a odrl:Permission .
ex:permission2 odrl:action odrl:modify .
ex:permission2 odrl:target <http://localhost:3000/alice/other/> .
ex:permission2 odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .
ex:permission2 odrl:assigner <https://pod.woutslabbinck.com/profile/card#me> .
`

const containerCreatePolicy = `
@prefix ex: <http://example.org/>.
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
ex:usagePolicy2a a odrl:Agreement .
ex:usagePolicy2a odrl:permission ex:permission2 .
ex:permission2a a odrl:Permission .
ex:permission2a odrl:action odrl:create .
ex:permission2a odrl:target <http://localhost:3000/alice/other/> .
ex:permission2a odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .
ex:permission2a odrl:assigner <https://pod.woutslabbinck.com/profile/card#me> .
`

const resourceReadPolicy = `
@prefix ex: <http://example.org/>.
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
ex:usagePolicy3 a odrl:Agreement .
ex:usagePolicy3 odrl:permission ex:permission3 .
ex:permission3 a odrl:Permission .
ex:permission3 odrl:action odrl:read .
ex:permission3 odrl:target <http://localhost:3000/alice/other/resource.txt> .
ex:permission3 odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .
ex:permission3 odrl:assigner <https://pod.woutslabbinck.com/profile/card#me> .
`
describe('Odrl Authorizer', () => {
    let policyStore: Store;
    let rulesStorage: UCRulesStorage = new MemoryUCRulesStorage();
    let odrlAuthorizer: Authorizer;
    let claims: ClaimSet;
    let query: Permission[];

    beforeAll(async () => {
        policyStore = await turtleStringToStore(resourceModifyPolicy);
        await rulesStorage.addRule(policyStore);
        odrlAuthorizer = new OdrlAuthorizer(rulesStorage);
    })

    beforeEach(async () => {
        claims = {'urn:solidlab:uma:claims:types:webid': 'https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me'}
        query = [
            {
                resource_id: 'http://localhost:3000/alice/other/resource.txt',
                resource_scopes: ['urn:example:css:modes:write', 'urn:example:css:modes:create']
            },
            {
                resource_id: 'http://localhost:3000/alice/other/',
                resource_scopes: ['urn:example:css:modes:create']
            }
        ]
    })

    test("for a modify policy, should give only write access when the claims match.", async () => {
        const expectedPermission: Permission[] = [
            {
                resource_id: 'http://localhost:3000/alice/other/resource.txt',
                resource_scopes: ['urn:example:css:modes:write']
            },
            {
                resource_id: 'http://localhost:3000/alice/other/',
                resource_scopes: []
            }
        ]
        const calculatedPermissions = await odrlAuthorizer.permissions(claims, query);
        expect(calculatedPermissions).toEqual(expectedPermission);
    });

    test("for a modify policy, should give no access due to lack of claims.", async () => {
        claims = {}
        const expectedPermission: Permission[] = [
            {
                resource_id: 'http://localhost:3000/alice/other/resource.txt',
                resource_scopes: []
            },
            {
                resource_id: 'http://localhost:3000/alice/other/',
                resource_scopes: []
            }
        ]
        const calculatedPermissions = await odrlAuthorizer.permissions(claims, query);
        expect(calculatedPermissions).toEqual(expectedPermission);
    });

    test("for appropriate create resource policies, should give all access when the claims match.", async () => {
        const policyStore = await turtleStringToStore(resourceModifyPolicy + resourceCreatePolicy + containerCreatePolicy + containerModifyPolicy + resourceReadPolicy);
        const ruleStorage = new MemoryUCRulesStorage();
        await ruleStorage.addRule(policyStore);
        const odrlAuthorizer = new OdrlAuthorizer(ruleStorage);
        const calculatedPermissions = await odrlAuthorizer.permissions(claims, query);
        expect(calculatedPermissions).toEqual(query);

    })
})
