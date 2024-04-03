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
    this.logger.info(`Received log access request at '${context.request.url}'`);
    
    return {
      body: JSON.stringify(await this.getLogMessages()),
      headers: {'content-type': 'application/trig'},
      status: 200,
    };
  }

  /**
   * Returns UMA Configuration for the AS
   * @return {UmaConfiguration} - AS Configuration
   */
  async getLogMessages(): Promise<string> {
    let messages = this.operationLogger.getLogEntries(null);
    let serializedStream = serializeQuads(messages, 'application/trig')
    return await streamToString(serializedStream) as string
  }
}


function streamToString (stream: any) {
  const chunks: any[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: any) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err: any) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  })
}
