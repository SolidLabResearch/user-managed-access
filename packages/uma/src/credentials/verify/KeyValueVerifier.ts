import { ClaimSet } from '../ClaimSet';
import { Credential } from '../Credential';
import { Verifier } from './Verifier';

/**
 * A verifier that assigns the credential token value as claims value, with the format being used as claims key.
 */
export class KeyValueVerifier implements Verifier {
  public constructor() {}

  public async verify(credential: Credential): Promise<ClaimSet> {
    return {
      [credential.format]: [ credential.token ],
    }
  }
}
