import { ANY_RESOURCE, ANY_SCOPE, Authorizer } from './Authorizer';
import { Permission } from '../../views/Permission';
import { ClaimSet } from '../../credentials/ClaimSet';
import { WEBID } from '../../credentials/Claims';
import { getLoggerFor } from 'global-logger-factory';

/**
 * An Authorizer granting access for WebID's to resources in given namespaces.
 */
export class WebIdAuthorizer implements Authorizer {
  protected readonly logger = getLoggerFor(this);

  /**
   * Creates a PublicNamespaceAuthorizer with the given public namespaces.
   *
   * @param webids - The WebIDs that can be used.
   */
  constructor(
    protected webids: string[],
  ) {}

  /** @inheritdoc */
  public async permissions(claims: ClaimSet, query?: Partial<Permission>[]): Promise<Permission[]> {
    this.logger.info(`Calculating permissions. ${JSON.stringify({ claims, query })}`);

    const webid = claims[WEBID];

    if (!(typeof webid === 'string' && this.webids.includes(webid))) return [];

    return (query ?? []).map(
      (permission): Permission => ({
        resource_id: permission.resource_id ?? ANY_RESOURCE,
        resource_scopes: permission.resource_scopes ?? [ ANY_SCOPE ]
      })
    );
  }
}
