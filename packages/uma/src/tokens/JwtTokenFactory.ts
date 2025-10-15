import { BadRequestHttpError, createErrorMessage, JwkGenerator, KeyValueStorage } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { importJWK, jwtVerify, SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import { array, reType } from '../util/ReType';
import { Permission } from '../views/Permission';
import { AccessToken } from './AccessToken';
import { SerializedToken, TokenFactory } from './TokenFactory';

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
    protected readonly tokenStore: KeyValueStorage<string, AccessToken>,
    protected readonly params: JwtTokenParams = { expirationTime: '30m', aud: 'solid' },
  ) {
    super();
  }

  /**
   * Serializes an Access Token into a JWT
   * @param {AccessToken} token - authenticated and authorized principal
   * @return {Promise<SerializedToken>} - access token response
   */
  public async serialize(token: AccessToken): Promise<SerializedToken> {
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
    await this.tokenStore.set(jwt, token);
    return { token: jwt, tokenType: 'Bearer' };
  }

  /**
   * Deserializes a JWT into an Access Token
   * @param {string} token - JWT access token
   * @return {Promise<AccessToken>} - deserialized access token
   */
  public async deserialize(token: string): Promise<AccessToken> {
    const key = await this.keyGen.getPublicKey();
    const jwk = await importJWK(key, key.alg);
    try {
      const { payload } = await jwtVerify(token, jwk, {
        issuer: this.issuer,
        audience: this.params.aud ?? AUD,
      });

      if (!payload.permissions) {
        throw new Error('missing required "permissions" claim.');
      }

      const permissions = payload.permissions;

      reType(permissions, array(Permission));

      return { permissions };
    } catch (error: unknown) {
      const msg = `Invalid Access Token provided, error while parsing: ${createErrorMessage(error)}`;
      this.logger.warn(msg);
      throw new BadRequestHttpError(msg);
    }
  }
}
