import {
  ActivityEmitter,
  AS,
  createErrorMessage,
  InternalServerError,
  ResourceIdentifier
} from '@solid/community-server';
import { StaticHandler } from 'asynchronous-handlers';
import { getLoggerFor } from 'global-logger-factory';
import { OwnerUtil } from '../util/OwnerUtil';
import type { UmaClient } from './UmaClient';

/**
 * Updates the UMA resource registrations when resources are added/removed.
 */
export class ResourceRegistrar extends StaticHandler {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    protected emitter: ActivityEmitter,
    protected ownerUtil: OwnerUtil,
    protected umaClient: UmaClient,
  ) {
    super();

    emitter.on(AS.Create, async (resource: ResourceIdentifier): Promise<void> => {
      try {
        const owner = await this.findOwner(resource);
        if (!owner)
          return;
        const { issuer, credentials } = await this.findUmaSettings(owner);
        this.umaClient.registerResource(resource, issuer, credentials).catch((err: Error) => {
          this.logger.error(`Unable to register resource ${resource.path}: ${createErrorMessage(err)}`);
        });
      } catch (err) {
        this.logger.error(`Unable to find UMA settings: ${createErrorMessage(err)}`);
      }
    });

    emitter.on(AS.Delete, async (resource: ResourceIdentifier): Promise<void> => {
      try {
        const owner = await this.findOwner(resource);
        if (!owner)
          return;
        const { issuer, credentials } = await this.findUmaSettings(owner);
        this.umaClient.deleteResource(resource, issuer, credentials).catch((err: Error) => {
          this.logger.error(`Unable to remove resource registration ${resource.path}: ${createErrorMessage(err)}`);
        });
      } catch (err) {
        this.logger.error(`Unable to find UMA settings: ${createErrorMessage(err)}`);
      }
    });
  }

  protected async findOwner(resource: ResourceIdentifier): Promise<string | undefined> {
    const webIds = await this.ownerUtil.findOwners(resource).catch((err) => {
      this.logger.debug(`Defaulting to empty list of owners: ${createErrorMessage(err)}`);
      return [];
    });
    if (webIds.length === 0) {
      // If there is no owner, we assume these are utility resources, such as in `.internal`
      return;
    }
    // For multiple owners we would need several changes, including supporting multiple UMA IDs per resource
    if (webIds.length > 1) {
      throw new InternalServerError('Only resources with a single owner are supported.');
    }
    return webIds[0];
  }

  protected async findUmaSettings(owner: string): Promise<{ issuer: string, credentials: string }> {
    const { credentials, issuer } = await this.ownerUtil.findUmaSettings(owner);

    if (!credentials || !issuer) {
      throw new InternalServerError(`Credentials and/or issuer are not set for ${owner}`);
    }

    return { credentials, issuer };
  }
}
