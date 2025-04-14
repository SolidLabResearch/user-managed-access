import { getLoggerFor, JwkGenerator } from '@solid/community-server';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';

/**
 * An HttpHandler used for returning the configuration
 * of the UMA Authorization Service.
 */
export class JwksRequestHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    private readonly generator: JwkGenerator
  ) {
    super();
  }

  async handle(context: HttpHandlerContext): Promise<HttpHandlerResponse> {
    this.logger.info(`Received JWKS request at '${context.request.url}'`);

    const key = await this.generator.getPublicKey();

    return {
      status: 200,
      body: { keys: [ key ] },
    };
  }
}
