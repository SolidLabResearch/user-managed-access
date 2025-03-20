import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';

/**
 * Default route handler
 */
export class DefaultRequestHandler extends HttpHandler {
  /**
     * Default request handler returning a 404 error
     * @param {HttpHandlerContext} input
     * @return {Observable<HttpHandlerResponse<any>>}
     */
  async handle(input: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    return {
      body: JSON.stringify({
        'status': 404,
        'error': 'Not Found',
      }),
      headers: {'content-type': 'application/json'},
      status: 404,
    };
  }
}
