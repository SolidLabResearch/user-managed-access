import { importJWK, jwtVerify, SignJWT } from 'jose';
import {
  BadRequestHttpError,
  createErrorMessage,
  getLoggerFor,
  JwkGenerator,
  KeyValueStorage
} from '@solid/community-server';
import { randomUUID } from 'node:crypto';
import { ClaimSet } from '../credentials/ClaimSet';
import { SerializedToken , TokenFactory} from './TokenFactory';
import { AccessToken } from './AccessToken';

const AUD = 'solid';

export interface JwtTokenParams {
    expirationTime: string | number
    aud: string
}

/**
 * A TokenFactory yielding its tokens as signed JWTs.
 */
export class JwtTokenFactory extends TokenFactory {
  protected readonly logger = getLoggerFor(this);

  /**
   * Construct a new ticket factory
   * @param keyGen - key generator to be used in issuance
   * @param issuer - server URL to assign to the issuer field
   * @param tokenStore - stores the link between JWT and access token
   * @param params - additional parameters for the generated JWT
   */
  constructor(
    protected readonly keyGen: JwkGenerator,
    protected readonly issuer: string,
    protected readonly tokenStore: KeyValueStorage<string, { token: AccessToken, claims?: ClaimSet }>,
    protected readonly params: JwtTokenParams = { expirationTime: '30m', aud: 'solid' },
  ) {
    super();
  }

  /**
   * Serializes an Access Token into a JWT
   * @param {AccessToken} token - authenticated and authorized principal
   * @param claims - claims used to acquire this token
   * @return {Promise<SerializedToken>} - access token response
   */
  public async serialize(token: AccessToken, claims?: ClaimSet): Promise<SerializedToken> {
    const key = await this.keyGen.getPrivateKey();
    const jwk = await importJWK(key, key.alg);
    const jwt = await new SignJWT({ permissions: token.permissions, contract: token.contract })
      .setProtectedHeader({ alg: key.alg, kid: key.kid })
      .setIssuedAt()
      .setIssuer(this.issuer)
      .setAudience(this.params.aud ?? AUD)
      .setExpirationTime(this.params.expirationTime)
      .setJti(randomUUID())
      .sign(jwk);

    this.logger.debug(`Issued new JWT Token ${JSON.stringify(token)}`);
    await this.tokenStore.set(jwt, { token, claims });
    return { token: jwt, tokenType: 'Bearer' };
  }

  /**
   * Deserializes a JWT into an Access Token
   * @param {string} token - JWT access token
   * @return {Promise<AccessToken>} - deserialized access token and claims
   */
  public async deserialize(token: string): Promise<{ token: AccessToken, claims?: ClaimSet }> {
    // TODO: might want to move this behaviour outside of this class as it is the same for all factories
    const result = await this.tokenStore.get(token);
    if (!result) {
      throw new BadRequestHttpError('Invalid Access Token provided');
    }
    return result;
  }
}
