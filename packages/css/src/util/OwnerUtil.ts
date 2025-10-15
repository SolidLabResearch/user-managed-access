import {
  AccountLoginStorage,
  AccountStore,
  InternalServerError,
  PodStore,
  ResourceIdentifier,
  StorageLocationStrategy,
  WEBID_STORAGE_DESCRIPTION,
  WEBID_STORAGE_TYPE,
  WrappedSetMultiMap
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import {
  ACCOUNT_SETTINGS_AS_TOKEN,
  ACCOUNT_SETTINGS_AUTHZ_SERVER,
  UMA_ACCOUNT_STORAGE_TYPE
} from '../identity/interaction/account/util/AccountSettings';

/**
 * ...
 */
export class OwnerUtil {
  protected readonly logger = getLoggerFor(this);

  private readonly accountStorage: AccountLoginStorage<{ [WEBID_STORAGE_TYPE]: typeof WEBID_STORAGE_DESCRIPTION }>;

  public constructor(
    // TODO: CSS does not have utility functions to go from WebID -> AccountID
    // Wrong typings to prevent Components.js typing issues
    accountStorage: AccountLoginStorage<Record<string, never>>,
    protected readonly accountStore: AccountStore<UMA_ACCOUNT_STORAGE_TYPE>,
    protected readonly podStore: PodStore,
    protected readonly storageStrategy: StorageLocationStrategy,
  ) {
    this.accountStorage = accountStorage as unknown as typeof this.accountStorage;
  }

  /**
   * Finds the owners of the given resource.
   */
  public async findOwners(resource: ResourceIdentifier): Promise<string[]> {
    const storage = await this.storageStrategy.getStorageIdentifier(resource);

    this.logger.debug(`Looking up pod corresponding to storage ${storage.path}`);
    const pod = await this.podStore.findByBaseUrl(storage.path);
    if (!pod)
      throw new InternalServerError(`Unable to find pod ${storage.path}`);

    this.logger.debug(`Looking up owners of pod ${pod.id}`);

    const owners = await this.podStore.getOwners(pod.id);
    if (!owners)
      throw new InternalServerError(`Unable to find owners for pod ${storage.path}`);

    return owners.map((owner) => owner.webId);
  }

  /**
   * Finds the WebID that is owner for all the given resources.
   */
  public async findCommonOwner(resources: Iterable<ResourceIdentifier>): Promise<string> {
    const resourceSet = new Set(resources);
    const ownerMap = new WrappedSetMultiMap<string, string>();

    for (const target of resourceSet) {
      const owners = await this.findOwners(target);

      for (const owner of owners)
        ownerMap.add(owner, target.path);
    }

    const validOwners: string[] = [];
    for (const [owner, targets] of ownerMap.entrySets()) {
      if (targets.size === resourceSet.size)
        validOwners.push(owner);
    }
    if (validOwners.length === 0) {
      throw new InternalServerError(
        `No common owner found for resources: ${Array.from(resources).map(r => r.path).join(', ')}`,
      );
    }
    if (validOwners.length > 1) {
      throw new InternalServerError(
        `Multiple common owners found for resources: ${Array.from(resources).map(r => r.path).join(', ')}`,
      );
    }

    return validOwners[0];
  }

  /**
   * Finds the issuer and PAT registered to the account that owns this WebID.
   * Errors if there are no or multiple accounts that link this WebID.
   */
  public async findUmaSettings(webId: string): Promise<{ issuer?: string, credentials?: string }> {
    const accounts = await this.accountStorage.find(WEBID_STORAGE_TYPE, { webId });
    if (accounts.length === 0) {
      throw new InternalServerError(`Unable to find an account linked to WebID ${webId}`);
    }
    if (accounts.length > 1) {
      throw new InternalServerError(`Found multiple accounts linked to WebID ${webId}`);
    }
    const accountId = accounts[0].accountId;
    const issuer = await this.accountStore.getSetting(accountId, ACCOUNT_SETTINGS_AUTHZ_SERVER);
    const credentials = await this.accountStore.getSetting(accountId, ACCOUNT_SETTINGS_AS_TOKEN);
    return { credentials, issuer };
  }
}
