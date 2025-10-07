import { BadRequestHttpError, getLoggerFor, UnauthorizedHttpError } from '@solid/community-server';
import { ClaimSet } from '../credentials/ClaimSet';
import { TokenFactory } from '../tokens/TokenFactory';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';
import { verifyRequest } from '../util/HttpMessageSignatures';


type IntrospectionResponse = {
  active : boolean,
  permissions: {
    resource_id: string,
    resource_scopes: string[],
    policies?: string[],
  }[],
  requestClaims?: ClaimSet,
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
   * @param tokenFactory - The factory with which tokens were produced.
   */
  constructor(
    private readonly tokenFactory: TokenFactory,
  ) {
    super();
  }

  async handle({request}: HttpHandlerContext): Promise<HttpHandlerResponse<IntrospectionResponse>> {
    if (!await verifyRequest(request)) throw new UnauthorizedHttpError();

    if (!request.body) {
      throw new BadRequestHttpError('Missing request body.');
    }

    const token = new URLSearchParams(request.body as Record<string, string>).get('token');
    try {
      if (!token) throw new Error('could not extract token from request body')
      const { token: unsignedToken, claims } = await this.tokenFactory.deserialize(token);
      return {
        status: 200,
        body: { ...unsignedToken, requestClaims: claims, active: true },
      };
    } catch (e) {
      this.logger.warn(`Token introspection failed: ${e}`)
      throw new BadRequestHttpError('Invalid request body.');
    }
  }
}
