import {BadRequestHttpError} from '../util/http/errors/BadRequestHttpError';
import {Logger} from '../util/logging/Logger';
import {getLoggerFor} from '../util/logging/LoggerUtils';
import {createLocalJWKSet, jwtVerify, SignJWT} from 'jose';
import {v4} from 'uuid';
import {JwksKeyHolder} from '../secrets/JwksKeyHolder';
import {isString} from '../util/StringGuard';
import {SerializedToken, TokenFactory} from './TokenFactory';
import {AccessToken} from './AccessToken';
import { array, reType } from '../util/ReType';
import { Permission } from '../views/Permission';

const AUD = 'solid';

type ErrorConstructor = { new(msg: string): Error };

export interface JwtTokenParams {
    expirationTime: string | number
    aud: string
}

/**
 * A TokenFactory yielding its tokens as signed JWTs.
 */
export class JwtTokenFactory extends TokenFactory {
  protected readonly logger: Logger = getLoggerFor(this);

  /**
     * Construct a new ticket factory
     * @param {JwksKeyHolder} keyholder - keyholder to be used in issuance
     */
  constructor(
    private readonly keyholder: JwksKeyHolder, 
    private readonly issuer: string,
    private readonly params: JwtTokenParams = {expirationTime: '30m', aud: 'solid'}
  ) {
    super();
  }

  /**
   * Serializes an Access Token into a JWT
   * @param {AccessTokentoken} token - authenticated and authorized principal
   * @return {Promise<SerializedToken>} - access token response
   */
  public async serialize(token: AccessToken): Promise<SerializedToken> {
    const kid = await this.keyholder.getDefaultKey();
    const jwt = await new SignJWT({ permissions: token.permissions })
      .setProtectedHeader({alg: this.keyholder.getAlg(), kid})
      .setIssuedAt()
      .setIssuer(this.issuer)
      .setAudience(AUD)
      .setExpirationTime(this.params.expirationTime)
      .setJti(v4())
      .sign(this.keyholder.getPrivateKey(kid));

    this.logger.debug('Issued new JWT Token', token);
    return {token: jwt, tokenType: 'Bearer'};
  }

  /**
   * Deserializes a JWT into an Access Token
   * @param {string} token - JWT access token
   * @return {Promise<AccessToken>} - deserialized access token
   */
  public async deserialize(token: string): Promise<AccessToken> {
    const jwks = createLocalJWKSet(await this.keyholder.getJwks());
    try {
      const {payload} = await jwtVerify(token, jwks, {
        issuer: this.issuer,
        audience: AUD,
      });

      if (/* !payload.sub ||*/ !payload.aud || !payload.permissions || !payload.azp || !payload.webid) {
        throw new Error('Missing JWT parameter(s): {sub, aud, permissions, webid, azp} are required.');
      }

      if (!isString(payload.webid)) throw new Error('JWT claim "webid" is not a string.');
      if (!isString(payload.azp)) throw new Error('JWT claim "azp" is not a string.');

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
   * @param {ErrorConstructor} constructor - the error constructor
   * @param {string} message - the error message
   */
  private error(constructor: ErrorConstructor, message: string): never {
    this.logger.warn(message);
    throw new constructor(message);
  }
}
