import { getLoggerFor } from 'global-logger-factory';
import { ClaimSet } from '../../credentials/ClaimSet';
import { RegistrationStore } from '../../util/RegistrationStore';
import { Permission } from '../../views/Permission';
import { Authorizer } from './Authorizer';

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
   * @param registrationStore - The key/value store containing the resource registrations.
   * @param namespacePosition - URL segment position to find the namespace, after removing the domain.
   *                            E.g., if URL is http://localhost:3000/alice/profile/card, `profile` has position 2.
   *                            Defaults to 2.
   */
  constructor(
    protected readonly authorizers: Record<string, Authorizer>,
    protected readonly fallback: Authorizer,
    protected readonly registrationStore: RegistrationStore,
    protected readonly namespacePosition = 2,
  ) {}

  /** @inheritdoc */
  public async permissions(claims: ClaimSet, query?: Partial<Permission>[]): Promise<Permission[]> {
    this.logger.info(`Calculating permissions. ${JSON.stringify({ claims, query })}`);

    // No permissions if no query
    if (!query || query.length === 0) return [];

    // Group requested permissions by applicable authorizer
    const groupedQueries = new Map<Authorizer, Partial<Permission>[]>();
    for (const permission of query) {
      const ns = permission.resource_id ? await this.findNamespace(permission.resource_id) : undefined;
      const authorizer = (ns && this.authorizers[ns]) || this.fallback;
      const existing = groupedQueries.get(authorizer);

      if (existing) {
        existing.push(permission);
      } else {
        groupedQueries.set(authorizer, [ permission ]);
      }
    }

    // Delegate each namespace-specific subset and merge all granted permissions.
    const permissionSets = await Promise.all(
      [ ...groupedQueries.entries() ].map(
        ([ authorizer, groupedQuery ]) => authorizer.permissions(claims, groupedQuery),
      ),
    );
    return permissionSets.flat();
  }

  /**
   * Finds the applicable authorizer to use based on the input query.
   */
  protected async findNamespace(resourceId?: string): Promise<string | undefined> {
    if (!resourceId) {
      return;
    }

    const registration = await this.registrationStore.get(resourceId);
    if (!registration) {
      this.logger.warn(`Cannot find a registered resource with id ${resourceId}`);
      return;
    }

    const resourceIdentifier = registration.description.name;
    if (!resourceIdentifier) {
      this.logger.warn(`Resource ${resourceId} has no registered name.`);
      return;
    }

    return new URL(resourceIdentifier).pathname.split('/')?.[this.namespacePosition] ?? '';
  }
}
