import {
  InternalServerError,
  joinUrl,
  PodStore,
  ResourceIdentifier,
  StorageLocationStrategy,
  WrappedSetMultiMap
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';

/**
 * ...
 */
export class OwnerUtil {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    protected podStore: PodStore,
    protected storageStrategy: StorageLocationStrategy,
    protected umaServerURL: string,
  ) {}

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

  public async findCommonOwner(resources: Iterable<ResourceIdentifier>): Promise<string> {
    const resourceSet = new Set(resources);
    const ownerMap = new WrappedSetMultiMap<string, string>();

    for (const target of resourceSet) {
      const owners = await this.findOwners(target);

      for (const owner of owners)
        ownerMap.add(owner, target.path);
    }

    for (const [owner, targets] of ownerMap.entrySets()) {
      if (targets.size === resourceSet.size)
        return owner;
    }

    throw new InternalServerError(
      `No common owner found for resources: ${Array.from(resources).map(r => r.path).join(', ')}`,
    );
  }

  public async findIssuer(webid: string): Promise<string | undefined> {
    this.logger.verbose(`Using UMA Authorization Server at ${this.umaServerURL} for WebID ${webid}.`);
    return joinUrl(this.umaServerURL, 'uma');
  }
}
