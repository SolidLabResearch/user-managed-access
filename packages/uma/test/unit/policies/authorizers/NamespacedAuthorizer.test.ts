import { Mocked } from 'vitest';
import { ClaimSet } from '../../../../src/credentials/ClaimSet';
import { Authorizer } from '../../../../src/policies/authorizers/Authorizer';
import { NamespacedAuthorizer } from '../../../../src/policies/authorizers/NamespacedAuthorizer';
import { Registration, RegistrationStore } from '../../../../src/util/RegistrationStore';

describe('NamespacedAuthorizer', (): void => {
  const claims: ClaimSet = { claim: 'set' };

  let authorizers: Record<string, Mocked<Authorizer>>;
  let fallback: Mocked<Authorizer>;
  let registrationStore: Mocked<RegistrationStore>;
  let authorizer: NamespacedAuthorizer;

  beforeEach(async(): Promise<void> => {
    authorizers = {
      ns1: { permissions: vi.fn().mockResolvedValue('perm1'), },
      ns2: { permissions: vi.fn().mockResolvedValue('perm2'), },
    };

    fallback = { permissions: vi.fn().mockResolvedValue('perm'), };

    const descriptions: Record<string, Registration> = {
      res1: { description: { name: 'http://example.com/foo/ns1/res', resource_scopes: [] }, owner: 'owner1' },
      res2: { description: { name: 'http://example.com/foo/ns2/res', resource_scopes: [] }, owner: 'owner2' },
      res3: { description: { name: 'http://example.com/foo/ns3/res', resource_scopes: [] }, owner: 'owner3' },
    }
    registrationStore = {
      get: vi.fn((id: string): any => descriptions[id]),
    } satisfies Partial<RegistrationStore> as any;

    authorizer = new NamespacedAuthorizer(authorizers, fallback, registrationStore);
  });

  describe('.permissions', (): void => {
    it('returns an empty list if there is no query or multiple identifiers.', async(): Promise<void> => {
      await expect(authorizer.permissions(claims)).resolves.toEqual([]);
      await expect(authorizer.permissions(claims, [])).resolves.toEqual([]);
      const query = [{ resource_id: 'res1' }, { resource_id: 'res2' }];
      await expect(authorizer.permissions(claims, query)).resolves.toEqual([]);
      expect(authorizers.ns1.permissions).toHaveBeenCalledTimes(0);
      expect(authorizers.ns2.permissions).toHaveBeenCalledTimes(0);
      expect(fallback.permissions).toHaveBeenCalledTimes(0);
    });

    it('calls the matching authorizer.', async(): Promise<void> => {
      const query = [{ resource_id: 'res2', resource_scopes: [ 'scope1' ] }];
      await expect(authorizer.permissions(claims, query)).resolves.toEqual('perm2');
      expect(authorizers.ns1.permissions).toHaveBeenCalledTimes(0);
      expect(authorizers.ns2.permissions).toHaveBeenCalledTimes(1);
      expect(authorizers.ns2.permissions).toHaveBeenLastCalledWith(claims, query);
      expect(fallback.permissions).toHaveBeenCalledTimes(0);
    });

    it('calls the fallback authorizer if there is no match.', async(): Promise<void> => {
      const query1 = [{ resource_id: 'res3' }];
      const query2 = [{ resource_id: 'unknown' }];
      await expect(authorizer.permissions(claims, query1)).resolves.toEqual('perm');
      await expect(authorizer.permissions(claims, query2)).resolves.toEqual('perm');
      expect(authorizers.ns1.permissions).toHaveBeenCalledTimes(0);
      expect(authorizers.ns2.permissions).toHaveBeenCalledTimes(0);
      expect(fallback.permissions).toHaveBeenCalledTimes(2);
      expect(fallback.permissions).toHaveBeenCalledWith(claims, query1);
      expect(fallback.permissions).toHaveBeenCalledWith(claims, query2);
    });
  });
});
