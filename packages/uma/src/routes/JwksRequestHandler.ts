import {HttpHandler} from '../http/models/HttpHandler';
import {HttpHandlerContext} from '../http/models/HttpHandlerContext';
import {HttpHandlerResponse} from '../http/models/HttpHandlerResponse';
import {Logger} from '../logging/Logger';
import {getLoggerFor} from '../logging/LoggerUtils';
import {JwksKeyHolder} from '../secrets/JwksKeyHolder';

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
  public constructor(private readonly keyholder: JwksKeyHolder) {
    this.keyholder = keyholder;
  }

  /**
     * Returns the JSON Web KeySet for specified keyholder
     * @param {HttpHandlerContext} context - an irrelevant incoming context
     * @return {Observable<HttpHandlerResponse>} - the JWKS response
     */
  async handle(context: HttpHandlerContext): Promise<HttpHandlerResponse> {
    this.logger.info(`Received JWKS request at '${context.request.url}'`);

    const jwks = await this.keyholder.getJwks();

    return {
      status: 200,
      headers: {
        'content-type': 'application/json'
      }, 
      body: JSON.stringify(jwks),
    };
  }
}
