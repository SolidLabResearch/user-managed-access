import { getLoggerFor } from '../../util/logging/LoggerUtils';
import { Authorizer } from './Authorizer';
import { Permission } from '../../views/Permission';
import { Requirements, type ClaimVerifier } from '../../credentials/Requirements';
import { ClaimSet } from '../../credentials/ClaimSet';

const NO_RESOURCE = Symbol();
const namespace = (resource: string) => new URL(resource).pathname.split('/')?.[2] ?? '';

/**
 * An authorizer delegating to different authorizers based on the namespaces in the request.
 */
export class NamespacedAuthorizer implements Authorizer {
  protected readonly logger = getLoggerFor(this);

  /**
   * Creates a NamespacedAuthorizer with the given namespaces.
   * 
   * @param config - A list of objects refering a list of namespaces to a specific Authorizer.
   */
  constructor(
    protected authorizers: Record<string, Authorizer>,
    protected fallback: Authorizer,
  ) {}

  /** @inheritdoc */
  public async permissions(claims: ClaimSet, query?: Partial<Permission>[]): Promise<Permission[]> {
    this.logger.info('Calculating permissions.', { claims, query });

    // No permissions if no query
    if (!query || query.length === 0) return [];

    // Base namespace on first resource
    const ns = query[0].resource_id ? namespace(query[0].resource_id) : undefined;

    // Check namespaces of other resources
    for (const permission of query) {
      if ((permission.resource_id ? namespace(permission.resource_id) : undefined) !== ns) {
        this.logger.warn(`Cannot calculate permissions over multiple namespaces at once.`);
        return [];
      }
    }

    // Find applicable authorizer
    const authorizer = ns ? this.authorizers[ns] : this.fallback;

    // Delegate to authorizer
    return authorizer.permissions(claims, query);
  }

  /** @inheritdoc */
  public async credentials(permissions: Permission[], query?: Requirements): Promise<Requirements[]> {
    this.logger.info('Calculating credentials.', { permissions, query });

    // No requirements if no requested permissions
    if (!permissions || permissions.length === 0) return [];

    // Base namespace on first resource
    const ns = namespace(permissions[0].resource_id);

    // Check namespaces of other resources
    for (const permission of permissions) {
      if (namespace(permission.resource_id) !== ns) {
        this.logger.warn(`Cannot calculate credentials over multiple namespaces at once.`);
        return [];
      }
    }

    // Find applicable authorizer
    const authorizer = this.authorizers[ns] ?? this.fallback;

    return authorizer.credentials(permissions, query);
  }
}
