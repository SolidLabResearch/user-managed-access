import { Logger } from '../../util/logging/Logger';
import { getLoggerFor } from '../../util/logging/LoggerUtils';
import { ANY_RESOURCE, ANY_SCOPE, Authorizer } from './Authorizer';
import { Permission } from '../../views/Permission';
import { Requirements } from '../../credentials/Requirements';
import { ClaimSet } from '../../credentials/ClaimSet';
import { WEBID } from '../../credentials/Claims';

/**
 * An Authorizer granting access for WebID's to resources in given namespaces.
 */
export class WebIdAuthorizer implements Authorizer {
  protected readonly logger: Logger = getLoggerFor(this);

  /**
   * Creates a PublicNamespaceAuthorizer with the given public namespaces.
   * 
   * @param namespaces - A list of namespaces that should be publicly accessible.
   * @param authorizer - The Authorizer to use for other resources.
   */
  constructor(
    protected webids: string[],
  ) {}

  /** @inheritdoc */
  public async permissions(claims: ClaimSet, query?: Partial<Permission>[]): Promise<Permission[]> {
    this.logger.info('Calculating permissions.', { claims, query });

    const webid = claims[WEBID];
    
    if (!(typeof webid === 'string' && this.webids.includes(webid))) return [];

    return (query ?? []).map(
      (permission): Permission => ({ 
        resource_id: permission.resource_id ?? ANY_RESOURCE, 
        resource_scopes: permission.resource_scopes ?? [ ANY_SCOPE ]
      })
    );
  }

  /** @inheritdoc */
  public async credentials(permissions: Permission[], query?: Requirements): Promise<Requirements[]> {
    this.logger.info('Calculating credentials.', { permissions, query });
    
    if (query && !Object.keys(query).includes(WEBID)) return [];

    return [{
      [WEBID]: async (webid) => typeof webid ===  'string' && this.webids.includes(webid),
    }];
  }
}
