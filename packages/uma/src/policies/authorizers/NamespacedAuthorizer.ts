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
