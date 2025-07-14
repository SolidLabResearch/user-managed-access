import {
  AccountStore,
  getLoggerFor,
  KeyValueStorage,
  PodStore,
  ResourceIdentifier,
  StorageLocationStrategy,
  WrappedSetMultiMap
} from '@solid/community-server';
import {
  ACCOUNT_SETTINGS_AUTHZ_SERVER,
  UMA_ACCOUNT_STORAGE_TYPE
} from '../identity/interaction/account/util/AccountSettings';

/**
 * ...
 */
export class OwnerUtil {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    protected podStore: PodStore,
    protected accountStore: AccountStore<UMA_ACCOUNT_STORAGE_TYPE>,
    protected storageStrategy: StorageLocationStrategy,
    protected umaPatStore: KeyValueStorage<string, { issuer: string, pat: string }>,
    protected umaServerURL: string,
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
    if (!this.umaServerURL) {
      this.logger.warn(`No UMA Authorization Server variable set. Falling back on http://localhost:4000/`)
      return 'http://localhost:4000/uma';
    }
    this.logger.verbose(`Using UMA Authorization Server at ${this.umaServerURL} for WebID ${webid}.`)
    return this.umaServerURL.endsWith('/') ? this.umaServerURL + 'uma' : this.umaServerURL + '/uma'

    // Dunno if it makes sense to code this as retrieving it from the WebID at this point?
    // I think we are far off from dynamically attaching multiple auth servers to a single solid server.

    // TODO: softcode

    // const profile = await fetchDataset(webid);
    // const quads = await readableToQuads(profile.data);
    // const issuers = quads.getObjects(namedNode(webid), UMA.terms.as, null);

    // return issuers.length > 0 ? issuers[0].value : undefined;
  }
}
