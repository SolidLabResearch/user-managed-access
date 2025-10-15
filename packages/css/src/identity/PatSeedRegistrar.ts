import {
  AccountLoginStorage,
  AccountStore,
  WEBID_STORAGE_DESCRIPTION,
  WEBID_STORAGE_TYPE
} from '@solid/community-server';
import { StaticHandler } from 'asynchronous-handlers';
import { getLoggerFor } from 'global-logger-factory';
import { UmaClient } from '../uma/UmaClient';
import type { StatusDependant } from '../util/fetch/StatusDependant';
import {
  ACCOUNT_SETTINGS_AS_TOKEN,
  ACCOUNT_SETTINGS_AUTHZ_SERVER,
  UMA_ACCOUNT_STORAGE_TYPE
} from './interaction/account/util/AccountSettings';
import { PatUpdater } from './PatUpdater';

/**
 * This class waits for the status to be set to true,
 * and then registers a PAT client credentials for every account that has a WebID.
 *
 * The intended goal is for this is to ensure seeded accounts automatically get PAT client credentials.
 * It needs to wait until the server is active and listening so the PausableFetcher can be used.
 */
export class PatSeedRegistrar extends StaticHandler implements StatusDependant<boolean> {
  protected readonly logger = getLoggerFor(this);

  private readonly accountStorage: AccountLoginStorage<{ [WEBID_STORAGE_TYPE]: typeof WEBID_STORAGE_DESCRIPTION }>;

  public constructor(
    // Wrong typings to prevent Components.js typing issues
    accountStorage: AccountLoginStorage<Record<string, never>>,
    protected readonly accountStore: AccountStore<UMA_ACCOUNT_STORAGE_TYPE>,
    protected readonly umaClient: UmaClient,
    protected readonly patUpdater: PatUpdater,
  ) {
    super();
    this.accountStorage = accountStorage as unknown as typeof this.accountStorage;
  }

  public async changeStatus(status: boolean): Promise<void> {
    if (status) {
      await this.initialize();
    }
  }

  protected async initialize(): Promise<void> {
    const accountMap: Record<string, string> = {};
    this.logger.info('Registering PATs for seeded accounts');
    for await (const { webId, accountId } of this.accountStorage.entries(WEBID_STORAGE_TYPE)) {
      // In case of multiple WebIDs just register the first one
      if (accountMap[accountId]) {
        this.logger.warn(`Multiple defined WebIDs for ${accountId}, only using ${accountMap[accountId]}`);
        continue;
      }
      if (await this.accountStore.getSetting(accountId, ACCOUNT_SETTINGS_AS_TOKEN)) {
        this.logger.debug(`Account ${accountId} with WebID ${webId} already has PAT client credentials`);
        continue;
      }
      const issuer = await this.accountStore.getSetting(accountId, ACCOUNT_SETTINGS_AUTHZ_SERVER);
      if (!issuer) {
        this.logger.warn(`No issuer defined for account ${accountId} with WebID ${webId}`);
        continue;
      }
      accountMap[accountId] = webId;
      const { id, secret } = await this.umaClient.generateClientCredentials(webId, issuer);
      this.logger.info(`Generated client credentials for WebID ${webId}`);

      await this.patUpdater.updateSettings(accountId, id, secret, issuer);
    }
  }
}
