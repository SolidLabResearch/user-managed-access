import {
  AccountLoginStorage,
  AccountStore,
  PodStore,
  ResourceIdentifier,
  StorageLocationStrategy,
  WEBID_STORAGE_DESCRIPTION,
  WEBID_STORAGE_TYPE
} from '@solid/community-server';
import { Mocked } from 'vitest';
import {
  ACCOUNT_SETTINGS_AS_TOKEN,
  ACCOUNT_SETTINGS_AUTHZ_SERVER,
  UMA_ACCOUNT_STORAGE_TYPE
} from '../../../src/identity/interaction/account/util/AccountSettings';
import { OwnerUtil } from '../../../src/util/OwnerUtil';

describe('OwnerUtil', (): void => {
  const webId = 'webId';
  const accountId = 'accountId';
  const issuer = 'issuer';
  const credentials = 'credentials';
  const storage: ResourceIdentifier = { path: 'storage' };
  const owners: { webId: string; visible: boolean }[] = [
    { webId: 'owner1', visible: true },
    { webId: 'owner2', visible: true },
  ];
  const basePod: { id: string, accountId: string } = { id: 'basePodId', accountId: 'accountId' };
  const resource: ResourceIdentifier = { path: 'resource' };
  let accountStorage: Mocked<AccountLoginStorage<{ [WEBID_STORAGE_TYPE]: typeof WEBID_STORAGE_DESCRIPTION }>>;
  let accountStore: Mocked<AccountStore<UMA_ACCOUNT_STORAGE_TYPE>>;
  let podStore: Mocked<PodStore>;
  let storageStrategy: Mocked<StorageLocationStrategy>;
  let ownerUtil: OwnerUtil;

  beforeEach(async(): Promise<void> => {
    accountStorage = {
      find: vi.fn().mockResolvedValue([{ accountId }])
    } satisfies Partial<AccountLoginStorage<Record<string, never>>> as any;

    accountStore = {
      getSetting: vi.fn().mockImplementation((id, setting) => {
        if (setting === ACCOUNT_SETTINGS_AUTHZ_SERVER) {
          return issuer;
        }
        if (setting === ACCOUNT_SETTINGS_AS_TOKEN) {
          return credentials;
        }
      }),
    } satisfies Partial<AccountStore<UMA_ACCOUNT_STORAGE_TYPE>> as any;

    podStore = {
      findByBaseUrl: vi.fn().mockResolvedValue(basePod),
      getOwners: vi.fn().mockResolvedValue(owners),
    } satisfies Partial<PodStore> as any;

    storageStrategy = {
      getStorageIdentifier: vi.fn().mockResolvedValue(storage),
    };

    ownerUtil = new OwnerUtil(accountStorage as any, accountStore, podStore, storageStrategy);
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

  it('returns the UMA settings.', async(): Promise<void> => {
    await expect (ownerUtil.findUmaSettings(webId)).resolves.toEqual({ issuer, credentials });
    expect(accountStorage.find).toHaveBeenCalledTimes(1);
    expect(accountStorage.find).toHaveBeenLastCalledWith(WEBID_STORAGE_TYPE, { webId });
    expect(accountStore.getSetting).toHaveBeenCalledTimes(2);
    expect(accountStore.getSetting).toHaveBeenNthCalledWith(1, accountId, ACCOUNT_SETTINGS_AUTHZ_SERVER);
    expect(accountStore.getSetting).toHaveBeenNthCalledWith(2, accountId, ACCOUNT_SETTINGS_AS_TOKEN);
  });

  it('errors if no matching account is found for the WebID.', async(): Promise<void> => {
    accountStorage.find.mockResolvedValueOnce([]);
    await expect(ownerUtil.findUmaSettings(webId)).rejects
      .toThrow(`Unable to find an account linked to WebID ${webId}`);
    expect(accountStorage.find).toHaveBeenCalledTimes(1);
    expect(accountStorage.find).toHaveBeenLastCalledWith(WEBID_STORAGE_TYPE, { webId });
    expect(accountStore.getSetting).toHaveBeenCalledTimes(0);
  });

  it('errors if multiple accounts are found for the WebID.', async(): Promise<void> => {
    accountStorage.find.mockResolvedValueOnce([ { id: accountId }, { id: accountId } ]);
    await expect(ownerUtil.findUmaSettings(webId)).rejects
      .toThrow(`Found multiple accounts linked to WebID ${webId}`);
    expect(accountStorage.find).toHaveBeenCalledTimes(1);
    expect(accountStorage.find).toHaveBeenLastCalledWith(WEBID_STORAGE_TYPE, { webId });
    expect(accountStore.getSetting).toHaveBeenCalledTimes(0);
  });
});
