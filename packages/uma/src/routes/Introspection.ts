import { BadRequestHttpError, getLoggerFor, KeyValueStorage, UnauthorizedHttpError } from '@solid/community-server';
import { AccessToken } from '../tokens/AccessToken';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';
import { verifyRequest } from '../util/HttpMessageSignatures';


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
   */
  constructor(
    private readonly tokenStore: KeyValueStorage<string, AccessToken>,
  ) {
    super();
  }

  public async handle({request}: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    if (!await verifyRequest(request)) throw new UnauthorizedHttpError();

    if (!request.body) {
      throw new BadRequestHttpError('Missing request body.');
    }

    try {
      const token = new URLSearchParams(request.body as Record<string, string>).get('token');
      if(!token) throw new Error('could not extract token from request body')
      const unsignedToken = await this.processJWTToken(token)
      return {
        status: 200,
        body: unsignedToken,
      };
    } catch (e) {
      // Todo: The JwtTokenFactory DOES NOT STORE THE TOKEN IN THE TOKENSTORE IN A WAY WE CAN RETRIEVE HERE! How to fix?
      this.logger.warn(`Token introspection failed: ${e}`);
      throw new BadRequestHttpError('Invalid request body.');
    }
  }

  protected async processJWTToken(signedJWT: string): Promise<IntrospectionResponse> {
    const token = await this.tokenStore.get(signedJWT);
    if (!token) throw new Error('Token not found.');
    return {
      active: true,
      ...token,
    };
  }
}
