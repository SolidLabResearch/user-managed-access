import { BadRequestHttpError } from '../util/http/errors/BadRequestHttpError';
import { HttpHandlerContext } from '../util/http/models/HttpHandlerContext';
import { HttpHandler } from '../util/http/models/HttpHandler';
import { HttpHandlerResponse } from '../util/http/models/HttpHandlerResponse';
import { UnauthorizedHttpError } from '../util/http/errors/UnauthorizedHttpError';
import { UnsupportedMediaTypeHttpError } from '../util/http/errors/UnsupportedMediaTypeHttpError';
import { Logger } from '../util/logging/Logger';
import { getLoggerFor } from '../util/logging/LoggerUtils';
import { KeyValueStore } from '../util/storage/models/KeyValueStore';
import { AccessToken } from '../tokens/AccessToken';
import { JwtTokenFactory } from '../tokens/JwtTokenFactory';
import { SerializedToken } from '../tokens/TokenFactory';
import { JwkGenerator } from '@solid/community-server';
import { verifyRequest } from '../util/HttpMessageSignatures';
import { jwtDecrypt } from 'jose';


type IntrospectionResponse = {
  active : boolean,
  permissions: {
    resource_id: string,
    resource_scopes: string[]
  }[],
  exp?: number,
  iat?: number,
  nbf?: number,
}


/**
 * An HTTP handler that provides introspection into opaque access tokens.
 */
export class IntrospectionHandler implements HttpHandler {
  protected readonly logger: Logger = getLoggerFor(this);

  /**
   * Creates an introspection handler for tokens in the given token store.
   * 
   * @param tokenStore - The store containing the tokens.
   * @param jwtTokenFactory - The factory with which to produce JWT representations of the tokens.
   */
  constructor(
    private readonly tokenStore: KeyValueStore<string, AccessToken>,
    private readonly jwtTokenFactory: JwtTokenFactory,
    private readonly keyGen: JwkGenerator,
  ) {}

  /**
  * Handle incoming requests for token introspection
  * @param {HttpHandlerContext} param0
  * @return {Observable<HttpHandlerResponse<any>>}
  */
  async handle({request}: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    if (!await verifyRequest(request)) throw new UnauthorizedHttpError();

    if (request.headers['content-type'] !== 'application/x-www-form-urlencoded') {
      throw new UnsupportedMediaTypeHttpError(
          'Only Media Type "application/x-www-form-urlencoded" is supported for this route.');
    }

    if (request.headers['accept'] !== 'application/json') {
      throw new UnsupportedMediaTypeHttpError(
          'Only "application/json" can be served by this route.');
    }

    if (!request.body /*|| !(request.body instanceof Object) */) { // todo: why was the object check here??
      throw new BadRequestHttpError('Missing request body.');
    }

    const token = new URLSearchParams(request.body).get('token');
    try {
      if(!token) throw new Error('could not extract token from request body')
      const unsignedToken = await this.processJWTToken(token)
      return {
        headers: {'content-type': 'application/json'},
        status: 200,
        body: unsignedToken,
      };
    } catch (e) {
      // Todo: The JwtTokenFactory DOES NOT STORE THE TOKEN IN THE TOKENSTORE IN A WAY WE CAN RETRIEVE HERE! How to fix?
      this.logger.warn(`Token introspection failed: ${e}`)
      throw new BadRequestHttpError('Invalid request body.');
    }


    // Opaque token left-overs - ask Wouter?

    // try {
    //   const opaqueToken = new URLSearchParams(request.body).get('token');
    //   if (!opaqueToken) throw new Error ();
      
    //   const jwt = this.opaqueToJwt(opaqueToken);
    //   return {
    //     headers: {'content-type': 'application/json'},
    //     status: 200,
    //     body: jwt,
    //   };
    // } catch (e) {
    //   throw new BadRequestHttpError('Invalid request body.');
    // }

  }


  private async processJWTToken(signedJWT: string): Promise<IntrospectionResponse> {
    this.logger.info(JSON.stringify(this.tokenStore.entries().next(), null, 2))
    const token = (await this.tokenStore.get(signedJWT)) as IntrospectionResponse;
    if (!token) throw new Error('Token not found.');
    token.active = true
    return token
  }

  // todo: check with Wouter what the goal here is? Since the Opaque Token Factory is not used atm?
  private async opaqueToJwt(opaque: string): Promise<SerializedToken> {
    const token = await this.tokenStore.get(opaque);
    if (!token) throw new Error('Token not found.');

    return this.jwtTokenFactory.serialize(Object.assign(token, { active: true }));
  }

}
