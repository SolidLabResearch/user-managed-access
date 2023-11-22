import {HttpHandler} from '../http/models/HttpHandler';
import {HttpHandlerContext} from '../http/models/HttpHandlerContext';
import {HttpHandlerResponse} from '../http/models/HttpHandlerResponse';
import {Observable, of} from 'rxjs';

/**
 * Default route handler
 */
export class DefaultRouteHandler extends HttpHandler {
  /**
     * Default request handler returning a 404 error
     * @param {HttpHandlerContext} input
     * @return {Observable<HttpHandlerResponse<any>>}
     */
  handle(input: HttpHandlerContext): Observable<HttpHandlerResponse<any>> {
    const response: HttpHandlerResponse = {
      body: JSON.stringify({
        'status': 404,
        'error': 'Not Found',
      }),
      headers: {'content-type': 'application/json'},
      status: 404,
    };

    return of(response);
  }
}
