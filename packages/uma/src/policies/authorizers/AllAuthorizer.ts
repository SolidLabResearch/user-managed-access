import { getLoggerFor } from '@solid/community-server';
import { ANY_RESOURCE, ANY_SCOPE, Authorizer } from './Authorizer';
import { Permission } from '../../views/Permission';
import { ClaimSet } from '../../credentials/ClaimSet';
import { Requirements } from '../../credentials/Requirements';

/**
 * Mock authorizer granting all specified access modes
 * to any client.
 *
 * NOTE: DO NOT USE THIS IN PRODUCTION
 */
export class AllAuthorizer implements Authorizer {
  protected readonly logger = getLoggerFor(this);

  /**
   * Creates a new AllAuthorizer. Warns for usage!
   */
  constructor() {
    this.logger.warn(`The AllAuthorizer was enabled. DO NOT USE THIS IN PRODUCTION!`);
  }

  /** @inheritdoc */
  public async permissions(claims: ClaimSet, query?: Partial<Permission>[]): Promise<Permission[]> {
    if (query) return query.map(permission => ({
      resource_id: permission.resource_id ?? ANY_RESOURCE,
      resource_scopes: permission.resource_scopes ?? [ ANY_SCOPE ] }));

    return [{ resource_id: ANY_RESOURCE, resource_scopes: [ ANY_SCOPE ] }];
  }

  /** @inheritdoc */
  public async credentials(permissions: Permission[]): Promise<Requirements[]> {
    this.logger.info(`Skipping credentials. ${JSON.stringify(permissions)}`);
    return [{}];
  }
}
