import { BadRequestHttpError, ForbiddenHttpError, KeyValueStorage } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { Permission } from '../../views/Permission';
import { ClaimSet } from '../ClaimSet';
import { Credential } from '../Credential';
import { REFRESH_TOKEN } from '../Formats';
import { Verifier } from './Verifier';

export type RefreshInformation = {
  claims: ClaimSet,
  permissions: Permission[],
  expiration: number,
}

/**
 * Extracts claims from a refresh token based on those stored in a key/value storage.
 */
export class RefreshTokenVerifier implements Verifier {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    protected readonly refreshStore: KeyValueStorage<string, RefreshInformation>,
  ) {
  }

  public async verify(credential: Credential): Promise<ClaimSet> {
    this.logger.debug(`Verifying credential ${JSON.stringify(credential)}`);
    if (credential.format !== REFRESH_TOKEN) {
      throw new BadRequestHttpError(`Token format ${credential.format} does not match this processor's format.`);
    }
    const information = await this.refreshStore.get(credential.token);
    if (!information) {
      throw new BadRequestHttpError(`Unknown refresh token ${credential.token}.`);
    }
    if (Date.now() > information.expiration) {
      await this.refreshStore.delete(credential.token);
      throw new ForbiddenHttpError(`Expired refresh token ${credential.token}`);
    }

    return information.claims;
  }
}
