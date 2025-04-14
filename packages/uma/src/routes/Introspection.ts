import { BadRequestHttpError, getLoggerFor, KeyValueStorage, UnauthorizedHttpError } from '@solid/community-server';
import { AccessToken } from '../tokens/AccessToken';
import { JwtTokenFactory } from '../tokens/JwtTokenFactory';
import { SerializedToken } from '../tokens/TokenFactory';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';
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
export class IntrospectionHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  /**
   * Creates an introspection handler for tokens in the given token store.
   *
   * @param tokenStore - The store containing the tokens.
   * @param jwtTokenFactory - The factory with which to produce JWT representations of the tokens.
   */
  constructor(
    private readonly tokenStore: KeyValueStorage<string, AccessToken>,
    private readonly jwtTokenFactory: JwtTokenFactory,
  ) {
    super();
  }

  async handle({request}: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    if (!await verifyRequest(request)) throw new UnauthorizedHttpError();

    if (!request.body /*|| !(request.body instanceof Object) */) { // todo: why was the object check here??
      throw new BadRequestHttpError('Missing request body.');
    }

    const token = new URLSearchParams(request.body as Record<string, string>).get('token');
    try {
      if(!token) throw new Error('could not extract token from request body')
      const unsignedToken = await this.processJWTToken(token)
      return {
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

    return this.jwtTokenFactory.serialize({ ...token, active: true } as AccessToken);
  }

}
