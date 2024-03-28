import { Logger } from '../../util/logging/Logger';
import { getLoggerFor } from '../../util/logging/LoggerUtils';
import { Authorizer } from './Authorizer';
import { Permission } from '../../views/Permission';
import { Requirements } from '../../credentials/Requirements';
import { ClaimSet } from '../../credentials/ClaimSet';

/**
 * Mock authorizer granting no access to any client.
 */
export class NoneAuthorizer implements Authorizer {
  protected readonly logger: Logger = getLoggerFor(this);

  /** @inheritdoc */
  public async permissions(claims: ClaimSet, query?: Partial<Permission>[]): Promise<Permission[]> {
    return [];
  }

  /** @inheritdoc */
  public async credentials(permissions: Permission[], query?: Requirements): Promise<Requirements[]> {
    // throw new ForbiddenHttpError();  // TODO: indicating impossibility to RS would save roundtrip
    return [];
  }
}
