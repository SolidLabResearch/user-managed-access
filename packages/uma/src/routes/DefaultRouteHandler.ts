import {HttpHandler} from '../http/models/HttpHandler';
import {HttpHandlerContext} from '../http/models/HttpHandlerContext';
import {HttpHandlerResponse} from '../http/models/HttpHandlerResponse';

/**
 * Default route handler
 */
export class DefaultRouteHandler extends HttpHandler {
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
