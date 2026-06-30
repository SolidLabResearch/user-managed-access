import { DataFactory, Parser, Store } from 'n3';
import { getAccessRequest, getPolicy, getPolicies } from '../../../../src/util/routeSpecific/get';
import {
  createOwnerAccessPolicy,
  getOwnerAccessPermissionId,
  getOwnerAccessPolicyId,
  OWNER_ACCESS_ACTIONS,
} from '../../../../src/util/SystemPolicy';
import { ODRL } from '../../../../src/ucp/util/Vocabularies';

const { namedNode } = DataFactory;

describe('routeSpecific/get', (): void => {
  const owner = 'http://rs.local:3000/alice/profile/card#me';
  const resource = 'http://rs.local:3000/alice/resource.txt';
  const policyId = getOwnerAccessPolicyId(resource);

  it('includes registered-resource owner access policies in policy listings.', async(): Promise<void> => {
    const store = new Store(createOwnerAccessPolicy(resource, owner));

    const result = await getPolicies(store, owner);

    for (const action of OWNER_ACCESS_ACTIONS) {
      const permissionId = getOwnerAccessPermissionId(resource, action.value);
      expect(result.countQuads(namedNode(policyId), ODRL.terms.permission, namedNode(permissionId), null)).toBe(1);
      expect(result.countQuads(namedNode(permissionId), ODRL.terms.action, action, null)).toBe(1);
      expect(result.countQuads(namedNode(permissionId), ODRL.terms.target, namedNode(resource), null)).toBe(1);
    }
  });

  it('can retrieve a registered-resource owner access policy by id.', async(): Promise<void> => {
    const store = new Store(createOwnerAccessPolicy(resource, owner));

    const result = await getPolicy(store, policyId, owner);

    for (const action of OWNER_ACCESS_ACTIONS) {
      const permissionId = getOwnerAccessPermissionId(resource, action.value);
      expect(result.countQuads(namedNode(policyId), ODRL.terms.permission, namedNode(permissionId), null)).toBe(1);
      expect(result.countQuads(namedNode(permissionId), ODRL.terms.assigner, namedNode(owner), null)).toBe(1);
    }
  });

  it('can retrieve an access request by compact id.', async(): Promise<void> => {
    const request = 'https://solid4media.ilabt.imec.be/uma/access-requests/34f152162e6e5e3c';
    const store = new Store(new Parser().parse(`
      @prefix ex: <http://example.org/> .
      @prefix sotw: <https://w3id.org/force/sotw#> .
      @prefix dcterms: <http://purl.org/dc/terms/> .
      @prefix odrl: <http://www.w3.org/ns/odrl/2/> .

      <${request}> a sotw:EvaluationRequest ;
        dcterms:issued "2026-06-30T00:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> ;
        sotw:requestedTarget <${resource}> ;
        sotw:requestedAction odrl:read ;
        sotw:requestingParty <${owner}> ;
        ex:requestStatus ex:requested .
    `));

    const result = await getAccessRequest(store, '2F34f152162e6e5e3c', owner);

    expect(result.countQuads(namedNode(request), null, null, null)).toBeGreaterThan(0);
  });
});
