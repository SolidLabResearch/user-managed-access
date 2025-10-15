import {
  AccountStore,
  BasicRepresentation,
  LDP,
  PodStore,
  Representation,
  RepresentationMetadata,
  ResourceIdentifier,
  ResourceStore
} from '@solid/community-server';
import { Mocked } from 'vitest';
import { flushPromises } from '../../../../../test/util/Util';
import {
  ACCOUNT_SETTINGS_AS_TOKEN,
  ACCOUNT_SETTINGS_AUTHZ_SERVER,
  UMA_ACCOUNT_STORAGE_TYPE
} from '../../../src/identity/interaction/account/util/AccountSettings';
import { PatUpdater } from '../../../src/identity/PatUpdater';
import { UmaClient } from '../../../src/uma/UmaClient';

function generateResource(id: ResourceIdentifier): Representation {
  if (id.path === '/') {
    return new BasicRepresentation('', new RepresentationMetadata({
      [LDP.contains]: [ '/foo/', '/bar' ],
    }));
  }
  if (id.path === '/foo/') {
    return new BasicRepresentation('', new RepresentationMetadata({
      [LDP.contains]: [ '/foo/baz' ],
    }));
  }
  return new BasicRepresentation();
}

describe('PatUpdater', (): void => {
  const accountId = 'accountId';
  const id = 'id';
  const secret = 'secret';
  const issuer = 'issuer';
  let accountStore: Mocked<AccountStore<UMA_ACCOUNT_STORAGE_TYPE>>;
  let podStore: Mocked<PodStore>;
  let resourceStore: Mocked<ResourceStore>;
  let umaClient: Mocked<UmaClient>;
  let updater: PatUpdater;

  beforeEach(async(): Promise<void> => {
    accountStore = {
      getSetting: vi.fn() as any,
      updateSetting: vi.fn(),
      create: vi.fn(),
    };

    podStore = {
      findPods: vi.fn().mockResolvedValue([{ baseUrl: '/' }]),
    } satisfies Partial<PodStore> as any;

    resourceStore = {
      getRepresentation: vi.fn(generateResource as any),
    } satisfies Partial<ResourceStore> as any;

    umaClient = {
      registerResource: vi.fn(),
      deleteResource: vi.fn(),
    } satisfies Partial<UmaClient> as any;

    updater = new PatUpdater(accountStore, podStore, resourceStore, umaClient);
  });

  it('registers all owned resources.', async(): Promise<void> => {
    await expect(updater.updateSettings(accountId, id, secret, issuer)).resolves.toBeUndefined();
    expect(accountStore.updateSetting).toHaveBeenCalledTimes(2);
    const authString = `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`;
    const credentials = `Basic ${Buffer.from(authString).toString('base64')}`;
    expect(accountStore.updateSetting).toHaveBeenNthCalledWith(1, accountId, ACCOUNT_SETTINGS_AS_TOKEN, credentials);
    expect(accountStore.updateSetting).toHaveBeenNthCalledWith(2, accountId, ACCOUNT_SETTINGS_AUTHZ_SERVER, issuer);

    await flushPromises();
    expect(umaClient.registerResource).toHaveBeenCalledTimes(4);
    expect(umaClient.registerResource).toHaveBeenCalledWith({ path: '/' }, issuer, credentials);
    expect(umaClient.registerResource).toHaveBeenCalledWith({ path: '/foo/' }, issuer, credentials);
    expect(umaClient.registerResource).toHaveBeenCalledWith({ path: '/foo/baz' }, issuer, credentials);
    expect(umaClient.registerResource).toHaveBeenCalledWith({ path: '/bar' }, issuer, credentials);
    expect(umaClient.deleteResource).toHaveBeenCalledTimes(0);
  });

  it('deletes registrations if they need to be replaced.', async(): Promise<void> => {
    accountStore.getSetting.mockImplementation(async (id: string, setting: string) => {
      if (setting === ACCOUNT_SETTINGS_AUTHZ_SERVER) {
        return 'oldIssuer';
      }
      if (setting === ACCOUNT_SETTINGS_AS_TOKEN) {
        return 'oldToken';
      }
    });

    await expect(updater.updateSettings(accountId, id, secret, issuer)).resolves.toBeUndefined();
    expect(accountStore.updateSetting).toHaveBeenCalledTimes(2);
    const authString = `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`;
    const credentials = `Basic ${Buffer.from(authString).toString('base64')}`;
    expect(accountStore.updateSetting).toHaveBeenNthCalledWith(1, accountId, ACCOUNT_SETTINGS_AS_TOKEN, credentials);
    expect(accountStore.updateSetting).toHaveBeenNthCalledWith(2, accountId, ACCOUNT_SETTINGS_AUTHZ_SERVER, issuer);

    await flushPromises();
    expect(umaClient.registerResource).toHaveBeenCalledTimes(4);
    expect(umaClient.registerResource).toHaveBeenCalledWith({ path: '/' }, issuer, credentials);
    expect(umaClient.registerResource).toHaveBeenCalledWith({ path: '/foo/' }, issuer, credentials);
    expect(umaClient.registerResource).toHaveBeenCalledWith({ path: '/foo/baz' }, issuer, credentials);
    expect(umaClient.registerResource).toHaveBeenCalledWith({ path: '/bar' }, issuer, credentials);
    expect(umaClient.deleteResource).toHaveBeenCalledTimes(4);
    expect(umaClient.deleteResource).toHaveBeenCalledWith({ path: '/' }, 'oldIssuer', 'oldToken');
    expect(umaClient.deleteResource).toHaveBeenCalledWith({ path: '/foo/' }, 'oldIssuer', 'oldToken');
    expect(umaClient.deleteResource).toHaveBeenCalledWith({ path: '/foo/baz' }, 'oldIssuer', 'oldToken');
    expect(umaClient.deleteResource).toHaveBeenCalledWith({ path: '/bar' }, 'oldIssuer', 'oldToken');
  });
});
