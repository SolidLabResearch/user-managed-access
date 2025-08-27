import { KeyValueStorage } from '@solid/community-server';
import { Mocked } from 'vitest';
import { ClaimSet } from '../../../../src/credentials/ClaimSet';
import { Authorizer } from '../../../../src/policies/authorizers/Authorizer';
import { NamespacedAuthorizer } from '../../../../src/policies/authorizers/NamespacedAuthorizer';
import { ResourceDescription } from '../../../../src/views/ResourceDescription';

describe('NamespacedAuthorizer', (): void => {
  const claims: ClaimSet = { claim: 'set' };

  let authorizers: Record<string, Mocked<Authorizer>>;
  let fallback: Mocked<Authorizer>;
  let resourceStore: Mocked<KeyValueStorage<string, ResourceDescription>>;
  let authorizer: NamespacedAuthorizer;

  beforeEach(async(): Promise<void> => {
    authorizers = {
      ns1: { permissions: vi.fn().mockResolvedValue('perm1'), credentials: vi.fn().mockResolvedValue('cred1'), },
      ns2: { permissions: vi.fn().mockResolvedValue('perm2'), credentials: vi.fn().mockResolvedValue('cred2'), },
    };

    fallback = { permissions: vi.fn().mockResolvedValue('perm'), credentials: vi.fn().mockResolvedValue('cred'), };

    const descriptions: Record<string, unknown> = {
      res1: { name: 'http://example.com/foo/ns1/res' },
      res2: { name: 'http://example.com/foo/ns2/res' },
      res3: { name: 'http://example.com/foo/ns3/res' },
    }
    resourceStore = {
      get: vi.fn((id: string): any => descriptions[id]),
    } satisfies Partial<KeyValueStorage<string, ResourceDescription>> as any;

    authorizer = new NamespacedAuthorizer(authorizers, fallback, resourceStore);
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

  describe('.credentials', (): void => {
    const query = { key: vi.fn() };

    it('returns an empty list if there are no permissions or multiple identifiers.', async(): Promise<void> => {
      await expect(authorizer.credentials([])).resolves.toEqual([]);
      const permissions = [{ resource_id: 'res1', resource_scopes: [] }, { resource_id: 'res2', resource_scopes: [] }];
      await expect(authorizer.credentials(permissions, query)).resolves.toEqual([]);
      expect(authorizers.ns1.credentials).toHaveBeenCalledTimes(0);
      expect(authorizers.ns2.credentials).toHaveBeenCalledTimes(0);
      expect(fallback.credentials).toHaveBeenCalledTimes(0);
    });

    it('calls the matching authorizer.', async(): Promise<void> => {
      const permissions = [{ resource_id: 'res2', resource_scopes: [ 'scope1' ] }];
      await expect(authorizer.credentials(permissions, query)).resolves.toEqual('cred2');
      expect(authorizers.ns1.credentials).toHaveBeenCalledTimes(0);
      expect(authorizers.ns2.credentials).toHaveBeenCalledTimes(1);
      expect(authorizers.ns2.credentials).toHaveBeenLastCalledWith(permissions, query);
      expect(fallback.credentials).toHaveBeenCalledTimes(0);
    });

    it('calls the fallback authorizer if there is no match.', async(): Promise<void> => {
      const perms1 = [{ resource_id: 'res3', resource_scopes: [ 'scope' ] }];
      const perms2 = [{ resource_id: 'unknown', resource_scopes: [ 'scope' ] }];
      await expect(authorizer.credentials(perms1, query)).resolves.toEqual('cred');
      await expect(authorizer.credentials(perms2, query)).resolves.toEqual('cred');
      expect(authorizers.ns1.credentials).toHaveBeenCalledTimes(0);
      expect(authorizers.ns2.credentials).toHaveBeenCalledTimes(0);
      expect(fallback.credentials).toHaveBeenCalledTimes(2);
      expect(fallback.credentials).toHaveBeenCalledWith(perms1, query);
      expect(fallback.credentials).toHaveBeenCalledWith(perms2, query);
    });
  });
});
