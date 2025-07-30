import type { UmaClient } from './UmaClient';
import { ResourceIdentifier, MonitoringStore, createErrorMessage } from '@solid/community-server';
import { AS, getLoggerFor, StaticHandler } from '@solid/community-server';
import { OwnerUtil } from '../util/OwnerUtil';

/**
 * Updates the UMA resource registrations when resources are added/removed.
 */
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
        this.umaClient.registerResource(resource, await this.findIssuer(owner)).catch((err: Error) => {
          this.logger.error(`Unable to register resource ${resource.path}: ${createErrorMessage(err)}`);
        });
      }
    });

    store.on(AS.Delete, async (resource: ResourceIdentifier): Promise<void> => {
      for (const owner of await this.findOwners(resource))  {
        this.umaClient.deleteResource(resource, await this.findIssuer(owner)).catch((err: Error) => {
          this.logger.error(`Unable to remove resource registration ${resource.path}: ${createErrorMessage(err)}`);
        });
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
