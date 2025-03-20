import { getLoggerFor } from '@solid/community-server';
import { getOperationLogger } from '../logging/OperationLogger';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';


/**
 * An HttpHandler used for returning the logs
 * stored in the UMA Authorization Service.
 */
export class VCRequestVerificationHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  operationLogger = getOperationLogger()

  /**
  * An HttpHandler for handling VC verification
  */
  constructor() {
    super();
  }

  /**
   * Returns the endpoint's UMA configuration
   *
   * @param {HttpHandlerContext} context - an irrelevant incoming context
   * @return {Observable<HttpHandlerResponse>} - the mock response
   */
  async handle(context: HttpHandlerContext): Promise<HttpHandlerResponse> {
    this.logger.info(`Received VC endpoint request at '${context.request.url}'`);

    return {
      body: '<this> <is> "the vc endpoint".',
      headers: {'content-type': 'application/trig'},
      status: 200,
    };
  }

}
