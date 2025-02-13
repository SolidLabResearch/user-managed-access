import { getLoggerFor } from '@solid/community-server';
import {HttpHandler} from '../models/HttpHandler';
import {HttpHandlerContext} from '../models/HttpHandlerContext';
import {HttpHandlerResponse} from '../models/HttpHandlerResponse';

export const statusCodes: { [code: number]: string } = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Payload Too Large',
  414: 'URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable',
  417: 'Expectation Failed',
  418: `I'm a teapot`,
  421: 'Misdirected Request',
  422: 'Unprocessable Entity',
  423: 'Locked',
  424: 'Failed Dependency',
  425: 'Too Early',
  426: 'Upgrade Required',
  428: 'Precondition required',
  429: 'Too Many Requests',
  431: 'Request Header Fields Too Large',
  451: 'Unavailable For Legal Reasons',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
  506: 'Variant Also Negotiates',
  507: 'Insufficient Storage',
  508: 'Loop detected',
  510: 'Not Extended',
  511: 'Network Authentication Required',
};

/**
 * Handler class that properly processes the HttpErrors from handlersjs-http
 */
export class JsonHttpErrorHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  /**
   * Creates an {ErrorHandler} that catches errors and returns an error response to the given handler.
   */
  constructor(
    private nestedHandler: HttpHandler,
  ) {
    super();
  }

  /**
   * Handle Http Request and catch any Errors that occur
   *
   * @param {HttpHandlerContext} context - Request context
   * @return {Observable<HttpHandlerResponse>}
   */
  async handle(context: HttpHandlerContext): Promise<HttpHandlerResponse> {
    try {
      return this.nestedHandler.handle(context);
    } catch (error) {
      this.logger.error(`Returned error for ${context.request.method} '${context.request.url}':` +
      ` ${(error as Error).name} ${(error as Error).message} ${JSON.stringify(error)}`);

      return {
        status: statusCodes[error?.statusCode] ? error.statusCode : 500,
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          'status': statusCodes[error?.statusCode] ? error.statusCode : 500,
          'description': statusCodes[error?.statusCode] ? statusCodes[error.statusCode] : statusCodes[500],
          'error': error?.type ?? error.type,
          'message': error?.message ?? error.message,
          ...(error?.additionalParams?error.additionalParams:{}),
        }),
      };
    };
  }
}
