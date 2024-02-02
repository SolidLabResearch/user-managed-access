import { Logger } from '../../util/logging/Logger';
import { getLoggerFor } from '../../util/logging/LoggerUtils';
import { Verifier } from './Verifier';
import { ClaimSet } from '../ClaimSet';
import { Credential } from "../Credential";
import { createSolidTokenVerifier } from '@solid/access-token-verifier';
import { OIDC } from '../Formats';
import { CLIENTID, WEBID } from '../Claims';

/**
 * A Verifier for OIDC ID Tokens.
 */
export class SolidOidcVerifier implements Verifier {
  protected readonly logger: Logger = getLoggerFor(this);

  private readonly verifyToken = createSolidTokenVerifier();

  /** @inheritdoc */
  public async verify(credential: Credential): Promise<ClaimSet> {
    if (credential.format !== OIDC) {
      throw new Error(`Token format ${credential.format} does not match this processor's format.`);
    }

    try {
      const claims = await this.verifyToken(`Basic ${credential.token}`);
      
      this.logger.info(`Authenticated via a Solid OIDC.`, claims);

      return ({ // TODO: keep issuer (and other metadata) for validation ??
        [WEBID]: claims.webid,
        ...claims.client_id && { [CLIENTID]: claims.client_id }
      });
      
    } catch (error: unknown) {
      const message = `Error verifying OIDC ID Token: ${(error as Error).message}`;

      this.logger.debug(message);
      throw new Error(message);
    }
  }
}
