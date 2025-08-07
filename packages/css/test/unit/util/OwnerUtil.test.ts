import { PodStore, ResourceIdentifier, StorageLocationStrategy } from '@solid/community-server';
import { Mocked } from 'vitest';
import { OwnerUtil } from '../../../src/util/OwnerUtil';

describe('OwnerUtil', (): void => {
  const umaServerURL = 'http://example.com/';
  const storage: ResourceIdentifier = { path: 'storage' };
  const owners: { webId: string; visible: boolean }[] = [
    { webId: 'owner1', visible: true },
    { webId: 'owner2', visible: true },
  ];
  const basePod: { id: string, accountId: string } = { id: 'basePodId', accountId: 'accountId' };
  const resource: ResourceIdentifier = { path: 'resource' };
  let podStore: Mocked<PodStore>;
  let storageStrategy: Mocked<StorageLocationStrategy>;
  let ownerUtil: OwnerUtil;

  beforeEach(async(): Promise<void> => {
    podStore = {
      findByBaseUrl: vi.fn().mockResolvedValue(basePod),
      getOwners: vi.fn().mockResolvedValue(owners),
    } satisfies Partial<PodStore> as any;

    storageStrategy = {
      getStorageIdentifier: vi.fn().mockResolvedValue(storage),
    };

    ownerUtil = new OwnerUtil(podStore, storageStrategy, umaServerURL);
  });

  it('can find the owners of a resource.', async(): Promise<void> => {
    await expect(ownerUtil.findOwners(resource)).resolves.toEqual([ 'owner1', 'owner2' ]);
    expect(storageStrategy.getStorageIdentifier).toHaveBeenCalledTimes(1);
    expect(storageStrategy.getStorageIdentifier).toHaveBeenLastCalledWith(resource);
    expect(podStore.findByBaseUrl).toHaveBeenCalledTimes(1);
    expect(podStore.findByBaseUrl).toHaveBeenLastCalledWith(storage.path);
    expect(podStore.getOwners).toHaveBeenCalledTimes(1);
    expect(podStore.getOwners).toHaveBeenLastCalledWith('basePodId');
  });

  it('errors if no pod can be found.', async(): Promise<void> => {
    podStore.findByBaseUrl.mockRejectedValueOnce(undefined);
    await expect(ownerUtil.findOwners(resource)).rejects.toThrow('Unable to find pod storage');
    expect(storageStrategy.getStorageIdentifier).toHaveBeenCalledTimes(1);
    expect(storageStrategy.getStorageIdentifier).toHaveBeenLastCalledWith(resource);
    expect(podStore.findByBaseUrl).toHaveBeenCalledTimes(1);
    expect(podStore.findByBaseUrl).toHaveBeenLastCalledWith(storage.path);
    expect(podStore.getOwners).toHaveBeenCalledTimes(0);
  });

  it('errors if no owners can be found.', async(): Promise<void> => {
    podStore.getOwners.mockRejectedValueOnce(undefined);
    await expect(ownerUtil.findOwners(resource)).rejects.toThrow('Unable to find owners for basePodId');
    expect(storageStrategy.getStorageIdentifier).toHaveBeenCalledTimes(1);
    expect(storageStrategy.getStorageIdentifier).toHaveBeenLastCalledWith(resource);
    expect(podStore.findByBaseUrl).toHaveBeenCalledTimes(1);
    expect(podStore.findByBaseUrl).toHaveBeenLastCalledWith(storage.path);
    expect(podStore.getOwners).toHaveBeenCalledTimes(1);
    expect(podStore.getOwners).toHaveBeenLastCalledWith('basePodId');
  });

  it('can find the common owner.', async(): Promise<void> => {
    podStore.getOwners.mockResolvedValueOnce([
      { webId: 'owner3', visible: true },
      { webId: 'owner2', visible: true },
    ]);
    await expect(ownerUtil.findCommonOwner([ { path: 'resource1' }, { path: 'resource2' } ])).resolves.toBe('owner2');
    expect(storageStrategy.getStorageIdentifier).toHaveBeenCalledTimes(2);
    expect(storageStrategy.getStorageIdentifier).toHaveBeenNthCalledWith(1, { path: 'resource1' });
    expect(storageStrategy.getStorageIdentifier).toHaveBeenNthCalledWith(2, { path: 'resource2' });
    expect(podStore.findByBaseUrl).toHaveBeenCalledTimes(2);
    expect(podStore.getOwners).toHaveBeenCalledTimes(2);
  });

  it('errors if there is no common owner.', async(): Promise<void> => {
    podStore.getOwners.mockResolvedValueOnce([
      { webId: 'owner3', visible: true },
    ]);
    await expect(ownerUtil.findCommonOwner([ { path: 'resource1' }, { path: 'resource2' } ])).rejects
      .toThrow('No common owner found for resources: resource1, resource2');
    expect(storageStrategy.getStorageIdentifier).toHaveBeenCalledTimes(2);
    expect(storageStrategy.getStorageIdentifier).toHaveBeenNthCalledWith(1, { path: 'resource1' });
    expect(storageStrategy.getStorageIdentifier).toHaveBeenNthCalledWith(2, { path: 'resource2' });
    expect(podStore.findByBaseUrl).toHaveBeenCalledTimes(2);
    expect(podStore.getOwners).toHaveBeenCalledTimes(2);
  });

  it('returns the stored issuer.', async(): Promise<void> => {
    await expect(new OwnerUtil(podStore, storageStrategy, 'http://example.com/').findIssuer('webId'))
      .resolves.toBe('http://example.com/uma');
    await expect(new OwnerUtil(podStore, storageStrategy, 'http://example.com').findIssuer('webId'))
      .resolves.toBe('http://example.com/uma');
    await expect(new OwnerUtil(podStore, storageStrategy, 'http://example.com/foo').findIssuer('webId'))
      .resolves.toBe('http://example.com/foo/uma');
  });
});
