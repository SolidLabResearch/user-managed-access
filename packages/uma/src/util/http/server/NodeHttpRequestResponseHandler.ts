import { OutgoingHttpHeader } from 'node:http';
import { HttpHandler } from '../models/HttpHandler';
import {
  BadRequestHttpError,
  getLoggerFor,
  HttpHandler as NodeHttpStreamsHandler,
  HttpHandlerInput,
  HttpRequest,
  readableToString,
  TargetExtractor
} from '@solid/community-server';
import { HttpHandlerContext } from '../models/HttpHandlerContext';
import { HttpHandlerRequest } from '../models/HttpHandlerRequest';
import { HttpHandlerResponse } from '../models/HttpHandlerResponse';
import { statusCodes } from './ErrorHandler';


/**
 * A { NodeHttpStreamsHandler } reading the request stream into a { HttpHandlerRequest },
 * passing it through a { HttpHandler } and writing the resulting { HttpHandlerResponse } to the response stream.
 */
export class NodeHttpRequestResponseHandler extends NodeHttpStreamsHandler {
  public logger = getLoggerFor(this);

  /**
   * Creates a { NodeHttpRequestResponseHandler } passing requests through the given handler.
   *
   * @param { HttpHandler } httpHandler - the handler through which to pass incoming requests.
   */
  constructor(
    private httpHandler: HttpHandler,
    protected readonly targetExtractor: TargetExtractor,
  ) {
    super();
  }

  private async parseBody(requestStream: HttpRequest): Promise<string | Record<string, string>> {
    const body = await readableToString(requestStream);
    const contentType = requestStream.headers['content-type'];

    this.logger.debug(`Parsing request body ${{ body, contentType }}`);

    if (contentType?.startsWith('application/json')) {
      try {
        return JSON.parse(body);
      } catch (error: any) {
        throw new BadRequestHttpError(error instanceof Error ? error.message : '');
      }
    }

    return body;

  }

  private parseResponseBody(
    body: unknown,
    contentType?: OutgoingHttpHeader,
  ) {
    // don't log the body if it is a buffer. It results in a long, illegible log.
    this.logger.debug(`Parsing response body ${
      JSON.stringify({ body: Buffer.isBuffer(body) ? '<Buffer>' : body, contentType })}`);

    if (typeof contentType === 'string' && contentType?.startsWith('application/json')) {
      return typeof body === 'string' || body instanceof Buffer ? body : JSON.stringify(body);
    } else {
      return body;
    }
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
      throw new Error('method of the request cannot be null or undefined.');
    }

    // Make sure first param doesn't start with multiple slashes
    const urlObject: URL = new URL((await this.targetExtractor.handleSafe({ request: requestStream })).path);

    const httpHandlerRequest: HttpHandlerRequest<string | Record<string, string>> = {
      url: urlObject,
      method: requestStream.method,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      headers: headers as { [key: string]: string },
      body: await this.parseBody(requestStream),
    };

    const context: HttpHandlerContext = { request: httpHandlerRequest };

    this.logger.info(`Domestic request: ${JSON.stringify({ eventType: 'domestic_request', context })}`);

    let response = await this.httpHandler.handle(context).catch<HttpHandlerResponse<string>>((error) => {
      const status = error?.statusCode ?? error.status;
      const message = error?.message ?? error.body;

      this.logger.warn(`Unhandled error is handled by Handlersjs: ${JSON.stringify(error)}`);

      return {
        headers: {},
        ... error,
        body: message ?? 'Internal Server Error',
        status: statusCodes[status] ? status : 500
      };
    });

    response.headers = response.headers ?? {};
    const contentTypeHeader = response.headers['content-type'] ?? response.headers['Content-Type'];

    // If the body is not a string or a buffer, for example an object, stringify it. This is needed
    // to use Buffer.byteLength and to eventually write the body to the response.
    // Functions will result in 'undefined' which is desired behavior
    const hasBody = Boolean(response.body && response.body !== '');
    const body: string | Buffer | undefined = hasBody
      ? typeof response.body === 'string' || Buffer.isBuffer(response.body)
        ? response.body
        : JSON.stringify(response.body)
      : undefined;

    const extraHeaders = {
      ... (
        hasBody &&
        !contentTypeHeader &&
        typeof response.body !== 'string' &&
        !Buffer.isBuffer(response.body)
      ) && {'content-type': 'application/json' },
      ... hasBody && { 'content-length': Buffer.byteLength(body!).toString() },
    };

    response = {
      ... response,
      body,
      headers: {
        ... response.headers,
        ... extraHeaders,
      },
    };

    this.logger.debug('Sending response');

    responseStream.writeHead(response.status, response.headers);
    if (hasBody) {
      responseStream.write(this.parseResponseBody(response.body, contentTypeHeader));
    }

    responseStream.end();

    this.logger.info(`Domestic response: ${JSON.stringify({
      eventType: 'domestic_response',
      response: {
        ... response,
        // Set body to string '<Buffer>' if it is a Buffer Object to not pollute logs
        ... (Buffer.isBuffer(body)) && { body: '<Buffer>' },
      }
    })}`);
  }
}
