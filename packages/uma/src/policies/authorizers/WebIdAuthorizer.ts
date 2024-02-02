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
    protected namespaces: string[] = [ 'private' ],
    protected authorizer: Authorizer,
  ) {}

  private inNamespaces(query: Permission) {
    return this.namespaces.includes(new URL(query.resource_id).pathname.split('/')?.[2] ?? '');
  }

  /** @inheritdoc */
  public async permissions(claims: ClaimSet, query?: Partial<Permission>[]): Promise<Permission[]> {
    this.logger.info('Calculating permissions.', { claims, query });

    const permissions: Permission[] = await this.authorizer.permissions(claims, query);

    const webid = claims['webid'];
    
    if (!(typeof webid === 'string' && this.webids.includes(webid))) return permissions;

    const extra: Permission[] = (query ?? []).filter(this.inNamespaces.bind(this)).map(
      (permission): Permission => ({ 
        resource_id: permission.resource_id ?? ANY_RESOURCE, 
        resource_scopes: permission.resource_scopes ?? [ ANY_SCOPE ]
      })
    );

    return permissions.concat(extra);
  }

  /** @inheritdoc */
  public async credentials(permissions: Permission[], query?: Requirements): Promise<Requirements> {
    this.logger.info('Calculating credentials.', { permissions, query });

    const credentials = await this.authorizer.credentials(permissions.filter(
      permission => !this.inNamespaces(permission)
    ), query);

    if (permissions.some(this.inNamespaces.bind(this)) && (!query || WEBID in query)) {
      this.logger.debug('Detected WebID-protected namespace(s)');

      credentials[WEBID] = this.webids.includes.bind(this.webids);
    }

    return credentials;
  }
}
