import { createErrorMessage, getLoggerFor } from '@solid/community-server';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../models/HttpHandler';

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
 * Handler class that properly processes the HttpErrors and returns JSON responses.
 * Both canHandle and handle response errors will be returned as a JSON response,
 * describing the error.
 */
export class JsonHttpErrorHandler extends HttpHandler<HttpHandlerContext<Buffer>, Buffer> {
  protected readonly logger = getLoggerFor(this);

  constructor(
    protected handler: HttpHandler<HttpHandlerContext<Buffer>, Buffer>,
  ) {
    super();
  }

  public async handle(context: HttpHandlerContext<Buffer>): Promise<HttpHandlerResponse<Buffer>> {
    try {
      return await this.handler.handleSafe(context);
    } catch (error) {
      this.logger.error(`Returned error for ${context.request.method} '${context.request.url}':` +
      ` ${createErrorMessage(error)}`);

      return {
        status: statusCodes[error?.statusCode] ? error.statusCode : 500,
        headers: {
          'content-type': 'application/json',
        },
        body: Buffer.from(JSON.stringify({
          'status': statusCodes[error?.statusCode] ? error.statusCode : 500,
          'description': statusCodes[error?.statusCode] ? statusCodes[error.statusCode] : statusCodes[500],
          'error': error?.type ?? error.type,
          'message': error?.message ?? error.message,
          ...(error?.additionalParams ? error.additionalParams : {}),
        })),
      };
    }
  }
}
