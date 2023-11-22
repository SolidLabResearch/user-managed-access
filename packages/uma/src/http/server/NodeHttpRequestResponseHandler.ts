/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable no-null/no-null */
import { Observable, of, Subject, throwError } from 'rxjs';
import { map, switchMap, toArray, catchError } from 'rxjs/operators';
import { v4 } from 'uuid';
import { getLogger, makeErrorLoggable } from '../../logging/LoggerUtils';
import { BadRequestHttpError } from '../errors/BadRequestHttpError';
import { HttpHandler } from '../models/HttpHandler';
import { HttpHandlerContext } from '../models/HttpHandlerContext';
import { HttpHandlerRequest } from '../models/HttpHandlerRequest';
import { HttpMethods } from '../models/HttpMethod';
import { statusCodes } from './ErrorHandler';
import { NodeHttpStreamsHandler } from './NodeHttpStreamsHandler';
import { NodeHttpStreams } from './NodeHttpStreams';

/**
 * A { NodeHttpStreamsHandler } reading the request stream into a { HttpHandlerRequest },
 * passing it through a { HttpHandler } and writing the resulting { HttpHandlerResponse } to the response stream.
 */
export class NodeHttpRequestResponseHandler implements NodeHttpStreamsHandler {

  public logger = getLogger();

  private requestId = '';
  private correlationId = '';

  /**
   * Creates a { NodeHttpRequestResponseHandler } passing requests through the given handler.
   *
   * @param { HttpHandler } httpHandler - the handler through which to pass incoming requests.
   */
  constructor(
    private httpHandler: HttpHandler,
    private poweredBy = 'handlers.js',
    private hsts?: { maxAge: number; includeSubDomains: boolean },
  ) {

    if (!httpHandler) {

      throw new Error('A HttpHandler must be provided');

    }

  }

  private parseBody(
    body: string,
    contentType?: string,
  ): string | { [key: string]: string } {

    // TODO: parse x-www-form-urlencoded body
    // case 'application/':
    //   return JSON.parse(`{"${decodeURIComponent(body).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g, '":"')}"}`);

    this.logger.debug('Parsing request body', { body: body.slice(0, 2000), contentType });

    if (contentType?.startsWith('application/json')) {

      try {

        return JSON.parse(body);

      } catch (error: any) {

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        throw new BadRequestHttpError(error.message);

      }

    }

    return body;

  }

  private parseResponseBody(
    body: unknown,
    contentType?: string,
  ) {

    // don't log the body if it is a buffer. It results in a long, illegible log.
    this.logger.debug('Parsing response body', { body: body instanceof Buffer ? '<Buffer>' : typeof body === 'string' ? body.slice(0, 2000) : body, contentType });

    if (contentType?.startsWith('application/json')) {

      return typeof body === 'string' || body instanceof Buffer ? body : JSON.stringify(body);

    } else {

      return body;

    }

  }

  /**
   * Reads the requestStream of its NodeHttpStreams pair into a HttpHandlerRequest,
   * creates a HttpHandlerContext from it, passes it through the { HttpHandler },
   * and writes the result to the responseStream.
   *
   * @param { NodeHttpStreams } noteHttpStreams - the incoming set of Node.js HTTP read and write streams
   * @returns an { Observable<void> } for completion detection
   */
  handle(nodeHttpStreams: NodeHttpStreams): Observable<void> {

    if (!nodeHttpStreams) {

      this.logger.error('No node http streams received');

      return throwError(() => new Error('node http streams object cannot be null or undefined.'));

    }

    if (!nodeHttpStreams.requestStream) {

      // No request was received, this path is technically impossible to reach
      this.logger.error('No request stream received', { nodeHttpStreams });

      return throwError(() => new Error('request stream cannot be null or undefined.'));

    }

    if (!nodeHttpStreams.requestStream.headers) {

      // No request headers were received, this path is technically impossible to reach
      this.logger.error('No request headers received', { requestStream: nodeHttpStreams.requestStream });

      return throwError(() => new Error('headers of the request cannot be null or undefined.'));

    }

    // Add a request id to to be logged with every log from here on
    const requestIdHeader = nodeHttpStreams.requestStream.headers['x-request-id'];
    this.requestId = (Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader) ?? v4();
    this.logger.setVariable('requestId', this.requestId);
    // Add a correlation id to be logged with every log from here on
    const correlationIdHeader = nodeHttpStreams.requestStream.headers['x-correlation-id'];
    this.correlationId = (Array.isArray(correlationIdHeader) ? correlationIdHeader[0] : correlationIdHeader) ?? v4();
    this.logger.setVariable('correlationId', this.correlationId);

    // Set the logger label to the last 5 characters of the request id
    this.logger.debug('Set initial Logger variables', { variables: this.logger.getVariables() });

    if (!nodeHttpStreams.responseStream) {

      // No response was received, this path is technically impossible to reach
      this.logger.error('No response stream received', { nodeHttpStreams });

      return throwError(() => new Error('response stream cannot be null or undefined.'));

    }

    const url = nodeHttpStreams.requestStream.url;

    if (!url) {

      // No request url was received, this path is technically impossible to reach
      this.logger.warn('No url received', { requestStream: nodeHttpStreams.requestStream });

      return throwError(() => new Error('url of the request cannot be null or undefined.'));

    }

    // Check if the request method is an HTTP method + this ensures typing throughout the file
    const method = Object.values(HttpMethods).find((m) => m === nodeHttpStreams.requestStream.method);

    if (!method) {

      if (nodeHttpStreams.requestStream.method) {

        // An unsupported method was received
        this.logger.debug('Invalid method received', { method: nodeHttpStreams.requestStream.method });
        this.logger.clearVariables();
        nodeHttpStreams.responseStream.writeHead(501, { 'Content-Type': 'application/json' });

        nodeHttpStreams.responseStream.write(JSON.stringify({
          error: 'http_request_method_not_valid',
          error_description: 'This is not a known HTTP verb',
        }));

        nodeHttpStreams.responseStream.end();

        return of(void 0);

      } else {

        // No request method was received, this path is technically impossible to reach
        this.logger.warn('No method received', { requestStream: nodeHttpStreams.requestStream });

        return throwError(() => new Error('method of the request cannot be null or undefined.'));

      }

    }

    const buffer = new Subject<any>();

    nodeHttpStreams.requestStream.on('data', (chunk) => buffer.next(chunk));
    nodeHttpStreams.requestStream.on('end', () => buffer.complete());

    return buffer.pipe(
      toArray(),
      map((chunks) => Buffer.concat(chunks).toString()),
      map((body) => {

        // Make sure first param doesn't start with multiple slashes
        const urlObject: URL = new URL(url.replace(/^\/+/, '/'), `http://${nodeHttpStreams.requestStream.headers.host}`);

        // Add host, path and method to the logger variables
        this.logger.setVariable('host', urlObject.host);
        this.logger.setVariable('path', urlObject.pathname + urlObject.search + urlObject.hash);
        this.logger.setVariable('method', method);

        const httpHandlerRequest: HttpHandlerRequest = {
          url: urlObject,
          method,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          headers: nodeHttpStreams.requestStream.headers as { [key: string]: string },
          ... (body && body !== '') && { body: this.parseBody(body, nodeHttpStreams.requestStream.headers['content-type']) },
        };

        return { request: httpHandlerRequest };

      }),
      switchMap((context: HttpHandlerContext) => {

        this.logger.info('Domestic request:', { eventType: 'domestic_request', context });

        return this.httpHandler.handle(context);

      }),
      catchError((error) => {

        const status = error?.statusCode ?? error.status;
        const message = error?.message ?? error.body;

        this.logger.warn(`Unhandled error is handled by Handlersjs :`, { error: makeErrorLoggable(error) });

        return of({ headers: {}, ... error, body: message ?? 'Internal Server Error', status: statusCodes[status] ? status : 500 });

      }),
      switchMap((response) => {

        const contentTypeHeader = response.headers['content-type'];

        const charsetString = contentTypeHeader ? contentTypeHeader.split(';')
          .filter((part: string[]) => part.includes('charset='))
          .map((part: string) => part.split('=')[1].toLowerCase())[0]
          ?? 'utf-8' : 'utf-8';

        if (
          charsetString !== 'ascii'
          && charsetString !== 'utf8'
          && charsetString !== 'utf-8'
          && charsetString !== 'utf16le'
          && charsetString !== 'ucs2'
          && charsetString !== 'ucs-2'
          && charsetString !== 'base64'
          && charsetString !== 'latin1'
          && charsetString !== 'binary'
          && charsetString !== 'hex'
        ) {

          this.logger.warn('Unsupported charset', { charsetString });

          return throwError(() => new Error('The specified charset is not supported'));

        }

        // If the body is not a string or a buffer, for example an object, stringify it. This is needed
        // to use Buffer.byteLength and to eventually write the body to the response.
        // Functions will result in 'undefined' which is desired behavior
        const body: string | Buffer = response.body !== undefined && response.body !== null ? typeof response.body === 'string' || response.body instanceof Buffer ? response.body : JSON.stringify(response.body) : undefined;

        const extraHeaders = {
          ... (body !== undefined && body !== null && !response.headers['content-type'] && !response.headers['Content-Type'] && typeof response.body !== 'string' && !(response.body instanceof Buffer)) && { 'content-type': 'application/json' },
          ... (body !== undefined && body !== null && !response.headers['content-length'] && !response.headers['Content-Length']) && { 'content-length': Buffer.byteLength(body, charsetString).toString() },
          ... (this.hsts?.maxAge) && { 'strict-transport-security': `max-age=${this.hsts.maxAge}${this.hsts.includeSubDomains ? '; includeSubDomains' : ''}` },
          'x-powered-by': this.poweredBy,
          'x-request-id': this.requestId,
          'x-correlation-id': this.correlationId,
        };

        // Reset variables so new requests will never share ids
        this.requestId = '';
        this.correlationId = '';

        return of({
          ... response,
          body,
          headers: {
            ... response.headers,
            ... extraHeaders,
          },
        });

      }),
      map((response) => {

        this.logger.debug('Sending response');

        nodeHttpStreams.responseStream.writeHead(response.status, response.headers);

        if (response.body !== undefined && response.body !== null) {

          const contentTypeHeader = response.headers['content-type'] || response.headers['Content-Type'];

          const body = this.parseResponseBody(response.body, contentTypeHeader);
          nodeHttpStreams.responseStream.write(body);

        }

        nodeHttpStreams.responseStream.end();

        let bodyToLog = '';

        // Set body to string '<Buffer>' if it is a Buffer Object to not pollute logs
        if (response.body && response.body instanceof Buffer) {

          bodyToLog = '<Buffer>';

        } else if (response.body && typeof response.body === 'string') {

          bodyToLog = response.body.slice(0, 2000);

        }

        this.logger.info('Domestic response:', {
          eventType: 'domestic_response',
          response: {
            ... response,
            ... (bodyToLog) && { body: bodyToLog },
          },
        });

        this.logger.clearVariables();

      }),
    );

  }

}
