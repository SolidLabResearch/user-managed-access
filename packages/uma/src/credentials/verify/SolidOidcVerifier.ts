import { createSolidTokenVerifier } from '@solid/access-token-verifier';
import { BadRequestHttpError } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { CLIENTID, WEBID } from '../Claims';
import { ClaimSet } from '../ClaimSet';
import { Credential } from '../Credential';
import { OIDC } from '../Formats';
import { Verifier } from './Verifier';

/**
 * A Verifier for OIDC ID Tokens.
 */
export class SolidOidcVerifier implements Verifier {
  protected readonly logger = getLoggerFor(this);

  private readonly verifyToken = createSolidTokenVerifier();

  /** @inheritdoc */
  public async verify(credential: Credential): Promise<ClaimSet> {
    this.logger.debug(`Verifying credential ${JSON.stringify(credential)}`);
    if (credential.format !== OIDC) {
      throw new BadRequestHttpError(`Token format ${credential.format} does not match this processor's format.`);
    }

    try {
      const claims = await this.verifyToken(`Bearer ${credential.token}`);

      this.logger.info(`Authenticated via a Solid OIDC. ${JSON.stringify(claims)}`);

      return ({ // TODO: keep issuer (and other metadata) for validation ??
        [WEBID]: claims.webid,
        ...claims.client_id && { [CLIENTID]: claims.client_id }
      });

    } catch (error: unknown) {
      const message = `Error verifying OIDC ID Token: ${(error as Error).message}`;

      this.logger.debug(message);
      throw new BadRequestHttpError(message);
    }
  }
}
