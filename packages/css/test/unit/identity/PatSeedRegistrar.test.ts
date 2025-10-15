import {
  AccountLoginStorage,
  AccountStore,
  TypeObject,
  WEBID_STORAGE_DESCRIPTION,
  WEBID_STORAGE_TYPE
} from '@solid/community-server';
import { Mocked } from 'vitest';
import {
  ACCOUNT_SETTINGS_AS_TOKEN,
  ACCOUNT_SETTINGS_AUTHZ_SERVER,
  UMA_ACCOUNT_STORAGE_TYPE
} from '../../../src/identity/interaction/account/util/AccountSettings';
import { PatSeedRegistrar } from '../../../src/identity/PatSeedRegistrar';
import { PatUpdater } from '../../../src/identity/PatUpdater';
import { UmaClient } from '../../../src/uma/UmaClient';

describe('PatSeedRegistrar', (): void => {
  let entries: TypeObject<typeof WEBID_STORAGE_DESCRIPTION>[];
  let accountStorage: Mocked<AccountLoginStorage<{ [WEBID_STORAGE_TYPE]: typeof WEBID_STORAGE_DESCRIPTION }>>;
  let accountStore: Mocked<AccountStore<UMA_ACCOUNT_STORAGE_TYPE>>;
  let umaClient: Mocked<UmaClient>;
  let patUpdater: Mocked<PatUpdater>;
  let registrar: PatSeedRegistrar;

  beforeEach(async(): Promise<void> => {
    entries = [
      { id: 'id1', accountId: 'account1', webId: 'webId1'},
      { id: 'id2', accountId: 'account2', webId: 'webId2'},
    ];

    accountStorage = {
      entries: vi.fn(async function*() {
        yield* entries;
      }),
    } as any;

    accountStore = {
      getSetting: vi.fn(async (id: string, setting: string) =>
        setting === ACCOUNT_SETTINGS_AUTHZ_SERVER ? 'issuer' : undefined) as any,
      updateSetting: vi.fn(),
      create: vi.fn(),
    };

    umaClient = {
      generateClientCredentials: vi.fn().mockResolvedValue({ id: 'id', secret: 'secret' }),
    } satisfies Partial<UmaClient> as any;

    patUpdater = {
      updateSettings: vi.fn(),
    } satisfies Partial<PatUpdater> as any;

    registrar = new PatSeedRegistrar(accountStorage as any, accountStore, umaClient, patUpdater);
  });

  it('initializes the PAT registrations once the status changes.', async(): Promise<void> => {
    await expect(registrar.changeStatus(true)).resolves.toBeUndefined();
    expect(accountStorage.entries).toHaveBeenCalledTimes(1);
    expect(accountStorage.entries).toHaveBeenLastCalledWith(WEBID_STORAGE_TYPE);
    expect(accountStore.getSetting).toHaveBeenCalledTimes(4);
    expect(accountStore.getSetting).toHaveBeenNthCalledWith(1, 'account1', ACCOUNT_SETTINGS_AS_TOKEN);
    expect(accountStore.getSetting).toHaveBeenNthCalledWith(2, 'account1', ACCOUNT_SETTINGS_AUTHZ_SERVER);
    expect(accountStore.getSetting).toHaveBeenNthCalledWith(3, 'account2', ACCOUNT_SETTINGS_AS_TOKEN);
    expect(accountStore.getSetting).toHaveBeenNthCalledWith(4, 'account2', ACCOUNT_SETTINGS_AUTHZ_SERVER);
    expect(umaClient.generateClientCredentials).toHaveBeenCalledTimes(2);
    expect(umaClient.generateClientCredentials).toHaveBeenNthCalledWith(1, 'webId1', 'issuer');
    expect(umaClient.generateClientCredentials).toHaveBeenNthCalledWith(2, 'webId2', 'issuer');
    expect(patUpdater.updateSettings).toHaveBeenCalledTimes(2);
    expect(patUpdater.updateSettings).toHaveBeenNthCalledWith(1, 'account1', 'id', 'secret', 'issuer');
    expect(patUpdater.updateSettings).toHaveBeenNthCalledWith(2, 'account2', 'id', 'secret', 'issuer');
  });

  it('only registers with the first WebID it finds', async(): Promise<void> => {
    entries = [
      ... entries,
      { id: 'id1', accountId: 'account1', webId: 'webId3'},
    ];
    await expect(registrar.changeStatus(true)).resolves.toBeUndefined();
    expect(umaClient.generateClientCredentials).toHaveBeenCalledTimes(2);
    expect(umaClient.generateClientCredentials).toHaveBeenNthCalledWith(1, 'webId1', 'issuer');
    expect(umaClient.generateClientCredentials).toHaveBeenNthCalledWith(2, 'webId2', 'issuer');
  });

  it('does nothing if there already are credentials', async(): Promise<void> => {
    accountStore.getSetting.mockImplementation(async (id: string, setting: string) => {
      if (setting === ACCOUNT_SETTINGS_AUTHZ_SERVER) {
        return 'issuer';
      }
      if (id === 'account1') {
        return 'token1';
      }
    });
    await expect(registrar.changeStatus(true)).resolves.toBeUndefined();
    expect(umaClient.generateClientCredentials).toHaveBeenCalledTimes(1);
    expect(umaClient.generateClientCredentials).toHaveBeenNthCalledWith(1, 'webId2', 'issuer');
  });

  it('does nothing if no issuer is defined.', async(): Promise<void> => {
    accountStore.getSetting.mockImplementation(async (id: string, setting: string) => {
      if (setting === ACCOUNT_SETTINGS_AUTHZ_SERVER && id === 'account1') {
        return 'issuer';
      }
    });
    await expect(registrar.changeStatus(true)).resolves.toBeUndefined();
    expect(umaClient.generateClientCredentials).toHaveBeenCalledTimes(1);
    expect(umaClient.generateClientCredentials).toHaveBeenNthCalledWith(1, 'webId1', 'issuer');
  });
});
