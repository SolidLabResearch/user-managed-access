import { Logger } from '../../util/logging/Logger';
import { getLoggerFor } from '../../util/logging/LoggerUtils';
import { Verifier } from './Verifier';
import { ClaimSet } from '../ClaimSet';
import { Credential } from "../Credential";
import { JWT } from '../Formats';
import { decodeJwt, decodeProtectedHeader, jwtVerify } from 'jose';
import buildGetJwks from 'get-jwks';

/**
 * An UNSECURE Verifier that parses Tokens of the format `encode_uri(webId)[:encode_uri(clientId)]`,
 * without performing any further verification.
 */
export class JwtVerifier implements Verifier {
  protected readonly logger: Logger = getLoggerFor(this);
  protected jwks = buildGetJwks();

  constructor(
    private readonly allowedClaims: string[],
    private readonly errorOnExtraClaims: boolean,
    private readonly verifyJwt: boolean,
  ) {}

  /** @inheritdoc */
  public async verify(credential: Credential): Promise<ClaimSet> {
    if (credential.format !== JWT) {
      throw new Error(`Token format '${credential.format}' does not match this processor's format.`);
    }

    const claims = decodeJwt(credential.token);
    
    if (this.verifyJwt) {
      if (!claims.iss) {
        throw new Error(`JWT should contain 'iss' claim.`);
      }
      
      const params = decodeProtectedHeader(credential.token);

      if (!params.alg) {
        throw new Error(`JWT should contain 'alg' header.`);
      }

      if (!params.kid) {
        throw new Error(`JWT should contain 'kid' header.`);
      }

      const jwk = await this.jwks.getJwk({
        domain: claims.iss,
        alg: params.alg,
        kid: params.kid,
      });

      await jwtVerify(credential.token, Object.assign(jwk, { type: 'JWK' }));
    }

    for (const claim of Object.keys(claims)) if (!this.allowedClaims.includes(claim)) {
      if (this.errorOnExtraClaims) throw new Error(`Claim '${claim}' not allowed.`);

      delete claims[claim];
    }    

    this.logger.warn(`Returning new claims: ${JSON.stringify(claims)}`)
    return claims;
  }
}
