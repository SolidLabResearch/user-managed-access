import {
  AccountStore,
  createErrorMessage,
  isContainerIdentifier,
  LDP,
  PodStore,
  ResourceStore
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { UmaClient } from '../uma/UmaClient';
import {
  ACCOUNT_SETTINGS_AS_TOKEN,
  ACCOUNT_SETTINGS_AUTHZ_SERVER,
  UMA_ACCOUNT_STORAGE_TYPE
} from './interaction/account/util/AccountSettings';

/**
 * A utility class that wraps everything necessary to register all of an account's resources when the PAT is updated.
 */
export class PatUpdater {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    protected readonly accountStore: AccountStore<UMA_ACCOUNT_STORAGE_TYPE>,
    protected readonly podStore: PodStore,
    protected readonly resourceStore: ResourceStore,
    protected readonly umaClient: UmaClient,
  ) {}

  public async updateSettings(accountId: string, id: string, secret: string, issuer: string): Promise<void> {
    const previousServer = await this.accountStore.getSetting(accountId, ACCOUNT_SETTINGS_AUTHZ_SERVER);
    const previousCredentials = await this.accountStore.getSetting(accountId, ACCOUNT_SETTINGS_AS_TOKEN);

    const authString = `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`;
    const credentials = `Basic ${Buffer.from(authString).toString('base64')}`;
    await this.accountStore.updateSetting(accountId, ACCOUNT_SETTINGS_AS_TOKEN, credentials);
    await this.accountStore.updateSetting(accountId, ACCOUNT_SETTINGS_AUTHZ_SERVER, issuer);

    const pods = await this.podStore.findPods(accountId);
    for (const { baseUrl: pod } of pods) {
      // Don't await this as that would make the request very slow
      this.updateRecursive(
        pod,
        issuer,
        credentials,
        (previousServer && previousCredentials) ? { issuer: previousServer, pat: previousCredentials } : undefined
      ).catch(error => this.logger.error(`Unable to update resource registrations: ${createErrorMessage(error)}`));
    }
  }

  protected async updateRecursive(
    resource: string,
    issuer: string,
    credentials: string,
    previous?: {issuer: string, pat: string },
  ): Promise<void> {
    const identifier = { path: resource };
    if (previous) {
      // Removing the previous registration
      await this.umaClient.deleteResource(identifier, previous.issuer, previous.pat);
    }
    await this.umaClient.registerResource(identifier, issuer, credentials);
    if (isContainerIdentifier(identifier)) {
      const representation = await this.resourceStore.getRepresentation(identifier, {});
      representation.data.destroy();
      const members = representation.metadata.getAll(LDP.terms.contains).map((term): string => term.value);
      await Promise.all(
        members.map((member): Promise<void> => this.updateRecursive(member, issuer, credentials, previous))
      );
    }
  }
}
