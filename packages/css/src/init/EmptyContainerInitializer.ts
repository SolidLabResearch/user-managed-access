import {
  BasicRepresentation,
  ensureTrailingSlash,
  Initializer,
  joinUrl,
  ResourceIdentifier,
  ResourceStore
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';

/**
 * Creates an empty container with the given identifier.
 */
export class EmptyContainerInitializer extends Initializer {
  protected readonly logger = getLoggerFor(this);

  protected readonly containerId: ResourceIdentifier;

  public constructor(
    protected readonly baseUrl: string,
    protected readonly container: string,
    protected readonly store: ResourceStore,
  ) {
    super();
    if (!container.endsWith('/')) {
      throw new Error(`Container paths should end with a slash, instead got ${container}`);
    }
    this.containerId = { path: ensureTrailingSlash(joinUrl(baseUrl, container)) };
  }

  public async handle(): Promise<void> {
    if (await this.store.hasResource(this.containerId)) {
      return;
    }
    this.logger.info(`Initializing container ${this.containerId.path}`);
    await this.store.setRepresentation(this.containerId, new BasicRepresentation());
  }
}
