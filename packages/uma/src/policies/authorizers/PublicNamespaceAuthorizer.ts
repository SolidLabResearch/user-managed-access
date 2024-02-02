import { Logger } from '../../util/logging/Logger';
import { getLoggerFor } from '../../util/logging/LoggerUtils';
import { ANY_RESOURCE, ANY_SCOPE, Authorizer } from './Authorizer';
import { Permission } from '../../views/Permission';
import { Requirements } from '../../credentials/Requirements';
import { ClaimSet } from '../../credentials/ClaimSet';

/**
 * An authorizer granting public access to resources in the given namespaces.
 */
export class PublicNamespaceAuthorizer implements Authorizer {
  protected readonly logger: Logger = getLoggerFor(this);

  /**
   * Creates a PublicNamespaceAuthorizer with the given public namespaces.
   * 
   * @param namespaces - A list of namespaces that should be publicly accessible.
   * @param authorizer - The Authorizer to use for other resources.
   */
  constructor(
    protected namespaces: string[] = [ 'profile', 'public' ],
    protected authorizer: Authorizer,
  ) {}

  private inNamespaces(query: Permission) {
    return this.namespaces.includes(new URL(query.resource_id).pathname.split('/')?.[2] ?? '');
  }

  /** @inheritdoc */
  public async permissions(claims: ClaimSet, query?: Partial<Permission>[]): Promise<Permission[]> {
    this.logger.info('Calculating permissions.', { claims, query });

    const privatePermissions: Permission[] = await this.authorizer.permissions(claims, query);

    const publicPermissions: Permission[] = (query ?? []).filter(this.inNamespaces).map(
      (permission): Permission => ({ 
        resource_id: permission.resource_id ?? ANY_RESOURCE, 
        resource_scopes: permission.resource_scopes ?? [ ANY_SCOPE ]
      })
    );

    return privatePermissions.concat(publicPermissions);
  }

  /** @inheritdoc */
  public async credentials(permissions: Permission[], query?: Requirements): Promise<Requirements> {
    this.logger.info('Calculating credentials.', { permissions, query });

    const privatePermissions = permissions.filter(
      permission => !this.inNamespaces(permission)
    );

    this.logger.debug('Dropping public permissions from input.', { privatePermissions });

    if (privatePermissions.length === 0) return ({});

    return await this.authorizer.credentials(privatePermissions, query);
  }
}
