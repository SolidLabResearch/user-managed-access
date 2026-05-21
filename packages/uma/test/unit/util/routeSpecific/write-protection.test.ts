import { Store } from 'n3';
import { deletePolicy } from '../../../../src/util/routeSpecific/delete';
import { patchPolicy } from '../../../../src/util/routeSpecific/patch';
import { createOwnerAccessPolicy, getOwnerAccessPolicyId } from '../../../../src/util/SystemPolicy';

describe('routeSpecific system policy write protection', (): void => {
  const owner = 'http://rs.local:3000/alice/profile/card#me';
  const resource = 'http://rs.local:3000/alice/README';
  const policyId = getOwnerAccessPolicyId(resource);

  it('does not reject PATCH with a system-managed policy error.', async(): Promise<void> => {
    const store = new Store(createOwnerAccessPolicy(resource, owner));

    await expect(patchPolicy(store, policyId, owner, 'INSERT DATA {}')).resolves.toBeUndefined();
  });

  it('does not reject DELETE with a system-managed policy error.', async(): Promise<void> => {
    const store = new Store(createOwnerAccessPolicy(resource, owner));

    await expect(deletePolicy(store, policyId, owner)).resolves.toBeUndefined();
  });
});
