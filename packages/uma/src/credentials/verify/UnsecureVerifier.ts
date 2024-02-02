import { Logger } from '../../util/logging/Logger';
import { getLoggerFor } from '../../util/logging/LoggerUtils';
import { Verifier } from './Verifier';
import { ClaimSet } from '../ClaimSet';
import { Credential } from "../Credential";
import { UNSECURE } from '../Formats';
import { CLIENTID, WEBID } from '../Claims';

/**
 * An UNSECURE Verifier that parses Tokens of the format `encode_uri(webId)[:encode_uri(clientId)]`,
 * without performing any further verification.
 */
export class UnsecureVerifier implements Verifier {
  protected readonly logger: Logger = getLoggerFor(this);

  constructor() {
    this.logger.warn("You are using an UnsecureVerifier. DO NOT USE THIS IN PRODUCTION !!!");
  }

  /** @inheritdoc */
  public async verify(credential: Credential): Promise<ClaimSet> {
    if (credential.format !== UNSECURE) {
      throw new Error(`Token format ${credential.format} does not match this processor's format.`);
    }

    const raw = credential.token.split(':');

    if (raw.length > 2) {
      throw new Error('Invalid token format, only one \':\' is expected.');
    }

    try {
      const claims = {
        [WEBID]: new URL(decodeURIComponent(raw[0])).toString(),
        [CLIENTID]: raw.length === 2 && new URL(decodeURIComponent(raw[1])).toString()
      };
      
      this.logger.info(`Authenticated as via unsecure verifier.`, claims);
      
      return claims;
      
    } catch (error: unknown) {
      const message = `Error verifying Access Token via WebID: ${(error as Error).message}`;
      
      this.logger.debug(message);
      throw new Error(message);
    }
  }
}
