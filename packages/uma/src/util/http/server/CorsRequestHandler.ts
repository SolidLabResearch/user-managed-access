import { getLogger } from '../../logging/LoggerUtils';
import { HttpHandler } from '../models/HttpHandler';
import { HttpHandlerContext } from '../models/HttpHandlerContext';
import { HttpHandlerResponse } from '../models/HttpHandlerResponse';

export const cleanHeaders = (headers: Record<string, string>): Record<string, string> => Object.entries(headers).reduce(
  (acc: Record<string, string>, [ key, value ]) => {

    const lKey = key.toLowerCase();

    return { ... acc, [lKey]: acc[lKey] ? `${acc[lKey]},${value}` : value };

  }, {},
);

export interface HttpCorsOptions {
  origins?: string[];
  allowMethods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}
export class CorsRequestHandler implements HttpHandler {

  public logger = getLogger();

  constructor(
    private handler: HttpHandler,
    private options?: HttpCorsOptions,
    private passThroughOptions: boolean = false,
  ) { }

  async handle(context: HttpHandlerContext): Promise<HttpHandlerResponse> {

    const { origins, allowMethods, allowHeaders, exposeHeaders, credentials, maxAge } = this.options || ({});

    const requestHeaders = context.request.headers;

    const cleanRequestHeaders = cleanHeaders(requestHeaders);

    const {
      /* eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructuring for removal */
      ['access-control-request-method']: requestedMethod,
      ['access-control-request-headers']: requestedHeaders,
      ... noCorsHeaders
    } = cleanRequestHeaders;

    const noCorsRequestContext = {
      ... context,
      request: {
        ... context.request,
        headers: {
          ... noCorsHeaders,
        },
      },
    };

    const requestedOrigin = cleanRequestHeaders.origin ?? '';

    const allowOrigin = origins
      ? origins.includes(requestedOrigin)
        ? requestedOrigin
        : undefined
      : credentials
        ? requestedOrigin
        : '*';

    const allowHeadersOrRequested = allowHeaders?.join(',') ?? requestedHeaders;

    if (context.request.method === 'OPTIONS') {

      /* Preflight Request */

      this.logger.debug('Processing preflight request');

      const routeMethods = context.route?.operations.map((op) => op.method);
      const allMethods = [ 'GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH' ];

      const initialOptions = this.passThroughOptions
        ? this.handler.handle(noCorsRequestContext)
        : Promise.resolve({ status: 204, headers: {} });

      return initialOptions
        .then((response) => ({
          ... response,
          headers: response.headers ? cleanHeaders(response.headers) : {},
        }))
        .then((response) => ({
          ... response,
          headers: {

            ... response.headers,
            ... allowOrigin && ({
              ... (allowOrigin !== '*') && { 
                'vary': [ ... new Set([ 
                  ... response.headers.vary?.split(',').map((v) => v.trim().toLowerCase()) ?? [], `origin` 
                ]) ].join(', ')
              },
              'access-control-allow-origin': allowOrigin,
              'access-control-allow-methods': (allowMethods ?? routeMethods ?? allMethods).join(', '),
              ... (allowHeadersOrRequested) && { 'access-control-allow-headers': allowHeadersOrRequested },
              ... (credentials) && { 'access-control-allow-credentials': 'true' },
              'access-control-max-age': (maxAge ?? -1).toString(),
            }),
          },
        }));

    } else {

      /* CORS Request */

      this.logger.debug('Processing CORS request');

      return this.handler.handle(noCorsRequestContext)
        .then((response) => ({
          ... response,
          headers: {
            ... response.headers,
            ... allowOrigin && ({
              'access-control-allow-origin': allowOrigin,
              ... (allowOrigin !== '*') && { 
                'vary': [ ... new Set([ 
                  ... response.headers?.vary?.split(',').map((v) => v.trim().toLowerCase()) ?? [], `origin` 
                ]) ].join(', ') 
              },
              ... (credentials) && { 'access-control-allow-credentials': 'true' },
              ... (exposeHeaders) && { 'access-control-expose-headers': exposeHeaders.join(',') },
            }),
          },
        }));

    }

  }

}
