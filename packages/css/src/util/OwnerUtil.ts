import { KeyValueStorage, PodStore, ResourceIdentifier, StorageLocationStrategy, WrappedSetMultiMap, 
  getLoggerFor } from '@solid/community-server';
import { ACCOUNT_SETTINGS_AUTHZ_SERVER, type AccountStore } from '../identity/interaction/account/util/AccountStore';

/**
 * ...
 */
export class OwnerUtil {
  protected readonly logger = getLoggerFor(this);

  /**
   * ...
   *
   * @param podStore
   * @param storageStrategy
   */
  public constructor(
    protected podStore: PodStore,
    protected accountStore: AccountStore,
    protected storageStrategy: StorageLocationStrategy,
    protected umaPatStore: KeyValueStorage<string, { issuer: string, pat: string }>,
  ) {}

  /**
   * Find the storage resource of the pod containing the given resource.
   */
  public async findStorage(resource: ResourceIdentifier): Promise<ResourceIdentifier> {
    this.logger.debug(`Looking up storage containing ${resource.path}`);

    try {
      return (await this.storageStrategy.getStorageIdentifier(resource));
    } catch {
      throw new Error(`Unable to find root storage for ${resource}`);
    }
  }

  /**
   * Finds the owners of the given resource.
   */
  public async findOwners(resource: ResourceIdentifier): Promise<string[]> {
    const storage = await this.storageStrategy.getStorageIdentifier(resource);

    this.logger.debug(`Looking up pod corresponding to storage ${storage.path}`);
    const pod = await this.podStore.findByBaseUrl(storage.path);
    if (!pod) throw new Error(`Unable to find pod ${storage.path}`);

    this.logger.debug(`Looking up owners of pod ${pod.id}`);

    const as = await this.accountStore.getSetting(pod.accountId, ACCOUNT_SETTINGS_AUTHZ_SERVER);
    this.logger.warn(`REAL AS is ${JSON.stringify(as)}`);

    const owners = await this.podStore.getOwners(pod.id);
    if (!owners) throw new Error(`Unable to find owners for pod ${storage.path}`);

    return owners.map((owner) => owner.webId);
  }

  public async findCommonOwner(resources: Iterable<ResourceIdentifier>): Promise<string> {
    const resourceSet = new Set(resources);
    const ownerMap = new WrappedSetMultiMap<string, string>();
    
    for (const target of resourceSet) {
      const storage = await this.findStorage(target);
      const owners = await this.findOwners(storage);

      for (const owner of owners) ownerMap.add(owner, target.path);
    }

    for (const [owner, targets] of ownerMap.entrySets()) {
      if (targets.size === resourceSet.size) return owner;
    }

    throw new Error(`No common owner found for resources: ${Array.from(resources).map(r => r.path).join(', ')}`);
  }

  public async findIssuer(webid: string): Promise<string | undefined> {
    return 'http://localhost:4000/uma';

    // TODO: softcode

    // const profile = await fetchDataset(webid);
    // const quads = await readableToQuads(profile.data);
    // const issuers = quads.getObjects(namedNode(webid), UMA.terms.as, null);

    // return issuers.length > 0 ? issuers[0].value : undefined;
  }
}
