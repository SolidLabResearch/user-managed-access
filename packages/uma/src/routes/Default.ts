import {HttpHandler} from '../util/http/models/HttpHandler';
import {HttpHandlerContext} from '../util/http/models/HttpHandlerContext';
import {HttpHandlerResponse} from '../util/http/models/HttpHandlerResponse';

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
