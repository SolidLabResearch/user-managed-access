import { getLoggerFor, KeyValueStorage } from '@solid/community-server';
import { ResourceDescription } from '../../views/ResourceDescription';
import { Authorizer } from './Authorizer';
import { Permission } from '../../views/Permission';
import { Requirements } from '../../credentials/Requirements';
import { ClaimSet } from '../../credentials/ClaimSet';

const namespace = (resource: string) => new URL(resource).pathname.split('/')?.[2] ?? '';

/**
 * An authorizer delegating to different authorizers based on the namespaces in the request.
 */
export class NamespacedAuthorizer implements Authorizer {
  protected readonly logger = getLoggerFor(this);

  /**
   * Creates a NamespacedAuthorizer with the given namespaces.
   *
   * @param authorizers - A key/value map with the key being the relevant namespace
   *                      and the value being the corresponding authorizer to use for that namespace.
   * @param fallback - Authorizer to use if there is no namespace match.
   * @param resourceStore - The key/value store containing the resource registrations.
   */
  constructor(
    protected authorizers: Record<string, Authorizer>,
    protected fallback: Authorizer,
    protected resourceStore: KeyValueStorage<string, ResourceDescription>,
  ) {}

  /** @inheritdoc */
  public async permissions(claims: ClaimSet, query?: Partial<Permission>[]): Promise<Permission[]> {
    this.logger.info(`Calculating permissions. ${JSON.stringify({ claims, query })}`);

    // No permissions if no query
    if (!query || query.length === 0) return [];

    // Base namespace on first resource
    const ns = query[0].resource_id ? await this.findNamespace(query[0].resource_id) : undefined;

    // Check namespaces of other resources
    for (let i = 1; i < query.length; ++i) {
      if ((query[i].resource_id ? await this.findNamespace(query[i].resource_id) : undefined) !== ns) {
        this.logger.warn(`Cannot calculate permissions over multiple namespaces at once.`);
        return [];
      }
    }

    // Find applicable authorizer
    const authorizer = (ns && this.authorizers[ns]) || this.fallback;

    // Delegate to authorizer
    return authorizer.permissions(claims, query);
  }

  /** @inheritdoc */
  public async credentials(permissions: Permission[], query?: Requirements): Promise<Requirements[]> {
    this.logger.info(`Calculating credentials. ${JSON.stringify({ permissions, query })}`);

    // No requirements if no requested permissions
    if (!permissions || permissions.length === 0) return [];

    // Base namespace on first resource
    const ns = await this.findNamespace(permissions[0].resource_id);

    // Check namespaces of other resources
    for (let i = 1; i < permissions.length; ++i) {
      if (await this.findNamespace(permissions[i].resource_id) !== ns) {
        this.logger.warn(`Cannot calculate credentials over multiple namespaces at once.`);
        return [];
      }
    }

    // Find applicable authorizer
    const authorizer = (typeof ns === 'string' && this.authorizers[ns]) || this.fallback;

    return authorizer.credentials(permissions, query);
  }

  /**
   * Finds the applicable authorizer to use based on the input query.
   */
  protected async findNamespace(resourceId?: string): Promise<string | undefined> {
    if (!resourceId) {
      return;
    }

    const description = await this.resourceStore.get(resourceId);
    if (!description) {
      this.logger.warn(`Cannot find a registered resource with id ${resourceId}`);
      return;
    }

    const resourceIdentifier = description.name;
    if (!resourceIdentifier) {
      this.logger.warn(`Resource ${resourceId} has no registered name.`);
      return
    }

    return namespace(resourceIdentifier);
  }
}
