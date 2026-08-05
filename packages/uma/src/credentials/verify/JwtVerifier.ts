import { getLoggerFor } from 'global-logger-factory';
import { decodeJwt, jwtVerify } from 'jose';
import { getJwks } from '../../util/JwtUtil';
import { ClaimSet } from '../ClaimSet';
import { Credential } from '../Credential';
import { JWT } from '../Formats';
import { Verifier } from './Verifier';

/**
 * An UNSECURE Verifier that parses Tokens of the format `encode_uri(webId)[:encode_uri(clientId)]`,
 * without performing any further verification.
 */
export class JwtVerifier implements Verifier {
  protected readonly logger = getLoggerFor(this);

  constructor(
    private readonly allowedClaims: string[],
    private readonly errorOnExtraClaims: boolean,
    private readonly verifyJwt: boolean,
  ) {}

  /** @inheritdoc */
  public async verify(credential: Credential): Promise<ClaimSet> {
    this.logger.debug(`Verifying credential ${JSON.stringify(credential)}`);
    if (credential.format !== JWT) {
      throw new Error(`Token format '${credential.format}' does not match this processor's format.`);
    }

    const claims = decodeJwt(credential.token);
    const result: ClaimSet = {};

    if (this.verifyJwt) {
      if (!claims.iss) {
        throw new Error(`JWT should contain 'iss' claim.`);
      }

      const jwkSet = await getJwks(claims.iss);
      await jwtVerify(credential.token, jwkSet);
    }

    for (const claim of Object.keys(claims)) {
      if (this.allowedClaims.includes(claim)) {
        result[claim] = Array.isArray(claims[claim]) ? claims[claim] : [claims[claim]];
      } else if (this.errorOnExtraClaims) {
        throw new Error(`Claim '${claim}' not allowed.`);
      }
    }

    this.logger.debug(`Returning discovered claims: ${JSON.stringify(result)}`)
    return result;
  }
}
