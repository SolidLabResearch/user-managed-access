import { importJWK, jwtVerify, SignJWT } from 'jose';
import {
  BadRequestHttpError,
  getLoggerFor,
  HttpErrorClass,
  JwkGenerator,
  KeyValueStorage
} from '@solid/community-server';
import { randomUUID } from 'node:crypto';
import { SerializedToken , TokenFactory} from './TokenFactory';
import { AccessToken } from './AccessToken';
import { array, reType } from '../util/ReType';
import { Permission } from '../views/Permission';

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
     * @param {JwkGenerator} keyGen - key generator to be used in issuance
     * @param {KeyValueStore<string, AccessToken>} tokenStore
     */
  constructor(
    private readonly keyGen: JwkGenerator,
    private readonly issuer: string,
    private readonly params: JwtTokenParams = {expirationTime: '30m', aud: 'solid'},
    private readonly tokenStore: KeyValueStorage<string, AccessToken>
  ) {
    super();
  }

  /**
   * Serializes an Access Token into a JWT
   * @param {AccessTokentoken} token - authenticated and authorized principal
   * @return {Promise<SerializedToken>} - access token response
   */
  public async serialize(token: AccessToken): Promise<SerializedToken> {
    const key = await this.keyGen.getPrivateKey();
    const jwk = await importJWK(key, key.alg);
    const jwt = await new SignJWT({ permissions: token.permissions, contract: token.contract })
      .setProtectedHeader({alg: key.alg, kid: key.kid})
      .setIssuedAt()
      .setIssuer(this.issuer)
      .setAudience(AUD)
      .setExpirationTime(this.params.expirationTime)
      .setJti(randomUUID())
      .sign(jwk);

    this.logger.debug(`Issued new JWT Token ${JSON.stringify(token)}`);
    await this.tokenStore.set(jwt, token);
    return {token: jwt, tokenType: 'Bearer'};
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
        audience: AUD,
      });

      if (/* !payload.sub ||*/ !payload.aud || !payload.permissions || !payload.azp || !payload.webid) {
        throw new Error('Missing JWT parameter(s): {sub, aud, permissions, webid, azp} are required.');
      }

      if (typeof payload.webid !== 'string') throw new Error('JWT claim "webid" is not a string.');
      if (typeof payload.azp !== 'string') throw new Error('JWT claim "azp" is not a string.');

      const permissions = payload.permissions;

      reType(permissions, array(Permission));

      return { permissions };
    } catch (error: any) {
      this.error(BadRequestHttpError, `Invalid Access Token provided, error while parsing: ${error.message}`);
    }
  }

  /**
   * Logs and throws an error
   *
   * @param {HttpErrorClass} constructor - the error constructor
   * @param {string} message - the error message
   */
  private error(constructor: HttpErrorClass, message: string): never {
    this.logger.warn(message);
    throw new constructor(message);
  }
}
