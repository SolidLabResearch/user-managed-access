import type { UmaClient } from '../uma/UmaClient';
import type { ResourceIdentifier, MonitoringStore } from '@solid/community-server';
import { AS, getLoggerFor, StaticHandler } from '@solid/community-server';
import { OwnerUtil } from '../util/OwnerUtil';

export class ResourceRegistrar extends StaticHandler {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    protected store: MonitoringStore,
    protected ownerUtil: OwnerUtil,
    protected umaClient: UmaClient,
  ) {
    super();

    store.on(AS.Create, async (resource: ResourceIdentifier): Promise<void> => {
      for (const owner of await this.findOwners(resource))  {
        this.umaClient.createResource(resource, await this.findIssuer(owner));
      }
    });

    store.on(AS.Delete, async (resource: ResourceIdentifier): Promise<void> => {
      for (const owner of await this.findOwners(resource))  {
        this.umaClient.deleteResource(resource, await this.findIssuer(owner));
      }
    });
  }

  private async findOwners(resource: ResourceIdentifier): Promise<string[]> {
    return await this.ownerUtil.findOwners(resource).catch(() => []);
  }

  private async findIssuer(owner: string): Promise<string> {
    const issuer = await this.ownerUtil.findIssuer(owner);
    if (!issuer) throw new Error(`Could not find UMA AS for resource owner ${owner}`);
    return issuer;
  }
}
