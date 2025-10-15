import { serializeQuads } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { getOperationLogger } from '../logging/OperationLogger';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';

/**
 * An HttpHandler used for returning the logs
 * stored in the UMA Authorization Service.
 */
export class LogRequestHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  protected readonly operationLogger = getOperationLogger()

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
  public async handle(context: HttpHandlerContext): Promise<HttpHandlerResponse> {
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
  protected async getLogMessages(): Promise<string> {
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
