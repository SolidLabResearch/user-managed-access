import { DataFactory, Store } from 'n3';
import { getPolicy, getPolicies } from '../../../../src/util/routeSpecific/get';
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
});
