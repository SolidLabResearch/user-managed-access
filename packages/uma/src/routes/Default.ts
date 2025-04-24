import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';

/**
 * Default route handler that returns a 404.
 */
export class DefaultRequestHandler extends HttpHandler {
  async handle(input: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    return {
      body: {
        'status': 404,
        'error': 'Not Found',
      },
      status: 404,
    };
  }
}
