import { ASYMMETRIC_CRYPTOGRAPHIC_ALGORITHM }
  from '@solid/access-token-verifier/dist/constant/ASYMMETRIC_CRYPTOGRAPHIC_ALGORITHM';
import { HttpHandler } from '../util/http/models/HttpHandler';
import { HttpHandlerContext } from '../util/http/models/HttpHandlerContext';
import { HttpHandlerResponse } from '../util/http/models/HttpHandlerResponse';
import { Logger } from '../util/logging/Logger';
import { getLoggerFor } from '../util/logging/LoggerUtils';
import { getOperationLogger } from '../logging/OperationLogger';
import { Quad } from 'n3';
import { serializeQuads } from '@solid/community-server';


/**
 * An HttpHandler used for returning the logs 
 * stored in the UMA Authorization Service.
 */
export class VCRequestVerificationHandler extends HttpHandler {
  protected readonly logger: Logger = getLoggerFor(this);

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

