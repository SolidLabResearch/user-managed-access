import { getLoggerFor } from 'global-logger-factory';
import { ClaimSet } from '../../credentials/ClaimSet';
import { Permission } from '../../views/Permission';
import { Authorizer } from './Authorizer';

/**
 * Mock authorizer granting no access to any client.
 */
export class NoneAuthorizer implements Authorizer {
  protected readonly logger = getLoggerFor(this);

  /** @inheritdoc */
  public async permissions(claims: ClaimSet, query?: Partial<Permission>[]): Promise<Permission[]> {
    return [];
  }
}
