import { getLoggerFor } from 'global-logger-factory';
import { ClaimSet } from '../ClaimSet';
import { Credential } from '../Credential';
import { Verifier } from './Verifier';

/**
 * A verifier that assigns the credential token value as claims value, with the format being used as claims key.
 */
export class KeyValueVerifier implements Verifier {
  protected readonly logger = getLoggerFor(this);

  constructor() {
    this.logger.warn("You are using an KeyValueVerifier. DO NOT USE THIS IN PRODUCTION !!!");
  }

  public async verify(credential: Credential): Promise<ClaimSet> {
    return {
      [credential.format]: credential.token
    }
  }
}
