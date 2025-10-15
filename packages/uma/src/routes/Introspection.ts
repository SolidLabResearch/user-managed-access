import { BadRequestHttpError, UnauthorizedHttpError } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { TokenFactory } from '../tokens/TokenFactory';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';
import { RequestValidator } from '../util/http/validate/RequestValidator';

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
   * @param tokenFactory - The factory with which tokens were produced.
   * @param validator - Verifies the validity of the request.
   */
  constructor(
    private readonly tokenFactory: TokenFactory,
    private readonly validator: RequestValidator,
  ) {
    super();
  }

  public async handle({ request }: HttpHandlerContext): Promise<HttpHandlerResponse<IntrospectionResponse>> {
    await this.validator.handleSafe({ request });

    if (!request.body) {
      throw new BadRequestHttpError('Missing request body.');
    }

    const token = new URLSearchParams(request.body as Record<string, string>).get('token');
    try {
      if (!token) throw new Error('could not extract token from request body')
      const unsignedToken = await this.tokenFactory.deserialize(token);
      return {
        status: 200,
        body: { ...unsignedToken, active: true },
      };
    } catch (e) {
      this.logger.warn(`Token introspection failed: ${e}`)
      throw new BadRequestHttpError('Invalid request body.');
    }
  }
}
