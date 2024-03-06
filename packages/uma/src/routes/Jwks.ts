import { HttpHandler } from '../util/http/models/HttpHandler';
import { HttpHandlerContext } from '../util/http/models/HttpHandlerContext';
import { HttpHandlerResponse } from '../util/http/models/HttpHandlerResponse';
import { Logger } from '../util/logging/Logger';
import { getLoggerFor } from '../util/logging/LoggerUtils';
import { JwkGenerator } from '@solid/community-server';

/**
 * An HttpHandler used for returning the configuration
 * of the UMA Authorization Service.
 */
export class JwksRequestHandler implements HttpHandler {
  protected readonly logger: Logger = getLoggerFor(this);

  /**
   * Yields a new request handler for JWKS
   * @param {JwksKeyHolder} keyholder - the keyholder to be used for serving JWKS
   */
  public constructor(
    private readonly generator: JwkGenerator
  ) {}

  /**
     * Returns the JSON Web KeySet for specified keyholder
     * @param {HttpHandlerContext} context - an irrelevant incoming context
     * @return {Observable<HttpHandlerResponse>} - the JWKS response
     */
  async handle(context: HttpHandlerContext): Promise<HttpHandlerResponse> {
    this.logger.info(`Received JWKS request at '${context.request.url}'`);

    const key = await this.generator.getPublicKey();

    return {
      status: 200,
      headers: {
        'content-type': 'application/json'
      }, 
      body: JSON.stringify({ keys: [ key ] }),
    };
  }
}
