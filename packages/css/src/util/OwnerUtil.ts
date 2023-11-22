import {PodStore, ResourceIdentifier, StorageLocationStrategy, WrappedSetMultiMap, 
  fetchDataset, getLoggerFor, readableToQuads} from '@solid/community-server';
import {UMA} from './Vocabularies.js';
import {DataFactory} from 'n3';

const {namedNode} = DataFactory;

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
    protected storageStrategy: StorageLocationStrategy,
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
    const ownerMap = new WrappedSetMultiMap<string, string>();

    let ts = 0;
    for (const target of resources) {
      ts += 1;

      const storage = await this.findStorage(target);
      const owners = await this.findOwners(storage);

      for (const owner of owners) ownerMap.add(owner, target.path);
    }

    for (const [owner, targets] of ownerMap.entrySets()) if (targets.size === ts) return owner;

    throw new Error(`No common owner found for resources: ${Array.from(resources).join(', ')}`);
  }

  public async findIssuer(webid: string): Promise<string | undefined> {
    return 'http://localhost:4000/uma';

    const profile = await fetchDataset(webid);
    const quads = await readableToQuads(profile.data);
    const issuers = quads.getObjects(namedNode(webid), UMA.terms.as, null);

    return issuers.length > 0 ? issuers[0].value : undefined;
  }
}
