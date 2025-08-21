import { AccountStore, PasswordStore, PodCreator } from '@solid/community-server';
import { Mocked } from 'vitest';
import {
  ACCOUNT_SETTINGS_AUTHZ_SERVER,
  ACCOUNT_SETTINGS_KEYS
} from '../../../src/identity/interaction/account/util/AccountSettings';
import { UmaSeededAccountInitializer } from '../../../src/init/UmaSeededAccountInitializer';
import * as fsExtra from 'fs-extra';

vi.mock('fs-extra', () => ({
  readJson: vi.fn(),
}));

describe('UmaSeededAccountInitializer', (): void => {
  const dummyConfig = [
    {
      email: 'hello@example.com',
      password: 'abc123',
      pods: [
        { name: 'pod1' },
        { name: 'pod2' },
        { name: 'pod3' },
      ],
      authz: {
        server: 'http://example.com',
      },
      keys: [
        'key1',
        'key2',
      ]
    },
    {
      podName: 'example2',
      email: 'hello2@example.com',
      password: '123abc',
    },
  ];
  const configFilePath = './seeded-pod-config.json';
  let accountStore: Mocked<AccountStore>;
  let passwordStore: Mocked<PasswordStore>;
  let podCreator: Mocked<PodCreator>;
  let initializer: UmaSeededAccountInitializer;

  beforeEach(async(): Promise<void> => {
    let count = 0;
    accountStore = {
      create: vi.fn(async(): Promise<string> => {
        count += 1;
        return `account${count}`;
      }),
      updateSetting: vi.fn(),
    } satisfies Partial<AccountStore> as any;

    let pwCount = 0;
    passwordStore = {
      create: vi.fn(async(): Promise<string> => {
        pwCount += 1;
        return `password${pwCount}`;
      }),
      confirmVerification: vi.fn(),
    } satisfies Partial<PasswordStore> as any;

    podCreator = {
      handleSafe: vi.fn(),
    } satisfies Partial<PodCreator> as any;

    vi.spyOn(fsExtra, 'readJson').mockResolvedValue(dummyConfig);

    initializer = new UmaSeededAccountInitializer({
      accountStore,
      passwordStore,
      podCreator,
      configFilePath,
    });
  });

  it('does not generate any accounts or pods if no config file is specified.', async(): Promise<void> => {
    await expect(new UmaSeededAccountInitializer({ accountStore, passwordStore, podCreator }).handle())
      .resolves.toBeUndefined();
    expect(accountStore.create).toHaveBeenCalledTimes(0);
  });

  it('errors if the seed file is invalid.', async(): Promise<void> => {
    vi.spyOn(fsExtra, 'readJson').mockResolvedValueOnce('invalid config');
    await expect(initializer.handle()).rejects
      .toThrow('Invalid account seed file: this must be a `array` type, but the final value was: `"invalid config"`.');
  });

  it('generates an account with the specified settings.', async(): Promise<void> => {
    await expect(initializer.handleSafe()).resolves.toBeUndefined();
    expect(accountStore.create).toHaveBeenCalledTimes(2);
    expect(accountStore.updateSetting).toHaveBeenCalledTimes(2);
    expect(accountStore.updateSetting)
      .toHaveBeenNthCalledWith(1, 'account1', ACCOUNT_SETTINGS_KEYS, [ 'key1', 'key2' ]);
    expect(accountStore.updateSetting)
      .toHaveBeenNthCalledWith(2, 'account1', ACCOUNT_SETTINGS_AUTHZ_SERVER, 'http://example.com');
    expect(passwordStore.create).toHaveBeenCalledTimes(2);
    expect(passwordStore.create).toHaveBeenNthCalledWith(1, 'hello@example.com', 'account1', 'abc123');
    expect(passwordStore.create).toHaveBeenNthCalledWith(2, 'hello2@example.com', 'account2', '123abc');
    expect(passwordStore.confirmVerification).toHaveBeenCalledTimes(2);
    expect(passwordStore.confirmVerification).toHaveBeenNthCalledWith(1, 'password1');
    expect(passwordStore.confirmVerification).toHaveBeenNthCalledWith(2, 'password2');
    expect(podCreator.handleSafe).toHaveBeenCalledTimes(3);
    expect(podCreator.handleSafe).toHaveBeenNthCalledWith(1, { accountId: 'account1', name: 'pod1', settings: {}});
    expect(podCreator.handleSafe).toHaveBeenNthCalledWith(2, { accountId: 'account1', name: 'pod2', settings: {}});
    expect(podCreator.handleSafe).toHaveBeenNthCalledWith(3, { accountId: 'account1', name: 'pod3', settings: {}});
  });

  it('does not throw exceptions when one of the steps fails.', async(): Promise<void> => {
    accountStore.create.mockRejectedValueOnce(new Error('bad data'));
    await expect(initializer.handleSafe()).resolves.toBeUndefined();
    expect(accountStore.create).toHaveBeenCalledTimes(2);
    // Steps for first account will be skipped due to error
    expect(passwordStore.create).toHaveBeenCalledTimes(1);
    expect(podCreator.handleSafe).toHaveBeenCalledTimes(0);
  });
});
