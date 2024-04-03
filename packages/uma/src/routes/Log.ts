import { ASYMMETRIC_CRYPTOGRAPHIC_ALGORITHM }
  from '@solid/access-token-verifier/dist/constant/ASYMMETRIC_CRYPTOGRAPHIC_ALGORITHM';
import { HttpHandler } from '../util/http/models/HttpHandler';
import { HttpHandlerContext } from '../util/http/models/HttpHandlerContext';
import { HttpHandlerResponse } from '../util/http/models/HttpHandlerResponse';
import { Logger } from '../util/logging/Logger';
import { getLoggerFor } from '../util/logging/LoggerUtils';


export type LogMessage = {
  id: string,
  message: string,
}

/**
 * An HttpHandler used for returning the logs 
 * stored in the UMA Authorization Service.
 */
export class LogRequestHandler extends HttpHandler {
  protected readonly logger: Logger = getLoggerFor(this);

  /**
   * Returns the endpoint's UMA configuration
   *
   * @param {HttpHandlerContext} context - an irrelevant incoming context
   * @return {Observable<HttpHandlerResponse>} - the mock response
   */
  async handle(context: HttpHandlerContext): Promise<HttpHandlerResponse> {
    this.logger.info(`Received log access request at '${context.request.url}'`);
    
    return {
      body: JSON.stringify(this.getLogMessages()),
      headers: {'content-type': 'application/json'},
      status: 200,
    };
  }

  /**
   * Returns UMA Configuration for the AS
   * @return {UmaConfiguration} - AS Configuration
   */
  public getLogMessages(): LogMessage[] {
    return [
      {
        id: 'urn:example:log:message1',
        message: 'This is a logged message'
      }
    ]
  }
}
