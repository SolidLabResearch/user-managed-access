import { getLoggerFor } from 'global-logger-factory';
import { getOperationLogger } from '../logging/OperationLogger';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';

/**
 * An HttpHandler used for returning the logs
 * stored in the UMA Authorization Service.
 */
export class ContractRequestHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  operationLogger = getOperationLogger()

  /**
  * An HttpHandler used for returning the configuration
  * of the UMA Authorization Service.
    * @param {string} baseUrl - Base URL of the AS
    */
  constructor(protected readonly baseUrl: string) {
    super();
  }

  /**
   * Returns the endpoint's UMA configuration
   *
   * @param {HttpHandlerContext} context - an irrelevant incoming context
   * @return {Observable<HttpHandlerResponse>} - the mock response
   */
  async handle(context: HttpHandlerContext): Promise<HttpHandlerResponse> {
    this.logger.info(`Received contract retrieval request at '${context.request.url}'`);

    return {
      body: '<this> <is> "the contract endpoint".',
      headers: {'content-type': 'application/trig'},
      status: 200,
    };
  }

}
