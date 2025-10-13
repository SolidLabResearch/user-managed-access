import {
  BadRequestHttpError,
  getLoggerFor,
  HttpHandler as NodeHttpStreamsHandler,
  HttpHandlerInput,
  TargetExtractor
} from '@solid/community-server';
import { buffer } from 'node:stream/consumers';
import { HttpHandler, HttpHandlerContext, HttpHandlerRequest } from '../models/HttpHandler';


/**
 * A { NodeHttpStreamsHandler } reading the request stream into a { HttpHandlerRequest },
 * passing it through a { HttpHandler } and writing the resulting { HttpHandlerResponse } to the response stream.
 */
export class NodeHttpRequestResponseHandler extends NodeHttpStreamsHandler {
  protected readonly logger = getLoggerFor(this);

  constructor(
    protected readonly httpHandler: HttpHandler<HttpHandlerContext<Buffer>, Buffer>,
    protected readonly targetExtractor: TargetExtractor,
  ) {
    super();
  }

  /**
   * Reads the requestStream of its HttpHandlerInput pair into a HttpHandlerRequest,
   * creates a HttpHandlerContext from it, passes it through the { HttpHandler },
   * and writes the result to the responseStream.
   *
   * @param { HttpHandlerInput } nodeHttpStreams - the incoming set of Node.js HTTP read and write streams
   * @returns an { Promise<void> } for completion detection
   */
  async handle(nodeHttpStreams: HttpHandlerInput): Promise<void> {
    const { request: requestStream, response: responseStream } = nodeHttpStreams;
    const { headers } = requestStream;

    if (!requestStream.method) {
      // No request method was received, this path is technically impossible to reach
      this.logger.warn('No method received');
      throw new BadRequestHttpError('method of the request cannot be null or undefined.');
    }

    const urlObject: URL = new URL((await this.targetExtractor.handleSafe({ request: requestStream })).path);

    const {
      'content-type': contentType,
      'content-length': contentLength,
      'transfer-encoding': transferEncoding,
    } = requestStream.headers;
    // RFC7230, §3.3: The presence of a message body in a request
    // is signaled by a Content-Length or Transfer-Encoding header field.
    // While clients SHOULD NOT use a Content-Length header on GET,
    // some still provide a Content-Length of 0 (but without Content-Type).
    const hasInputBody = (contentLength && !(/^0+$/u.test(contentLength) && !contentType)) || transferEncoding;
    if (hasInputBody && !contentType) {
      this.logger.warn('HTTP request has a body, but no Content-Type header');
      throw new BadRequestHttpError('HTTP request body was passed without a Content-Type header');
    }

    const httpHandlerRequest: HttpHandlerRequest<Buffer> = {
      url: urlObject,
      method: requestStream.method,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      headers: headers as { [key: string]: string },
      ...hasInputBody && { body: await buffer(requestStream) },
    };

    const context: HttpHandlerContext<Buffer> = { request: httpHandlerRequest };

    this.logger.info(`Domestic request: ${JSON.stringify({ eventType: 'domestic_request', context: {
      request: {
        ...context.request,
        ...context.request.body && { body: context.request.body.toString() }
      }
      } })}`);

    let response = await this.httpHandler.handleSafe(context);

    response.headers = {
      // headers could be undefined at this point
      ...response.headers,
      ...response.body && { 'content-length': Buffer.byteLength(response.body).toString() }
    }

    this.logger.debug('Sending response');

    responseStream.writeHead(response.status, response.headers);
    if (response.body) {
      responseStream.write(response.body);
    }

    responseStream.end();

    this.logger.info(`Domestic response: ${JSON.stringify({
      eventType: 'domestic_response',
      response: {
        ... response,
        // Limit max length in logs
        ... response.body && { body: (response.body.length > 200 ? '<Buffer>' : response.body.toString()) },
      }
    })}`);
  }
}
