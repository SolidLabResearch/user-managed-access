import { getLogger } from '../../logging/LoggerUtils';
import { HttpHandler } from '../models/HttpHandler';
import { HttpHandlerContext } from '../models/HttpHandlerContext';
import { HttpHandlerController } from '../models/HttpHandlerController';
import { HttpHandlerResponse } from '../models/HttpHandlerResponse';
import { HttpHandlerRoute } from '../models/HttpHandlerRoute';

/**
 * A {HttpHandler} handling requests based on routes in a given list of {HttpHandlerController}s.
 *
 * @class
 */
export class RoutedHttpRequestHandler implements HttpHandler {

  private pathToRouteMap: Map<string, { controller: HttpHandlerController; route: HttpHandlerRoute }[]>;
  public logger = getLogger();

  /**
   * Creates a RoutedHttpRequestHandler, super calls the HttpHandler class and expects a list of HttpHandlerControllers
   *
   * @param {HttpHandlerController[]} handlerControllerList - a list of HttpHandlerController objects
   */
  constructor(private handlerControllerList: HttpHandlerController[], private defaultHandler?: HttpHandler) {

    if (!handlerControllerList) {

      throw new Error('handlerControllerList must be defined.');

    }

    this.pathToRouteMap = new Map();

    this.handlerControllerList.flatMap((controller) =>
      controller.routes.forEach((route) => {

        const existing = this.pathToRouteMap.get(route.path);

        existing
          ? this.pathToRouteMap.set(route.path, [ ... existing, { controller, route } ])
          : this.pathToRouteMap.set(route.path, [ { controller, route } ]);

      }));

  }

  /**
   * Passes the { HttpHandlerContext } to the handler of the { HttpHandlerRoute } matching the request's path.
   *
   * @param { HttpHandlerContext } context - a HttpHandlerContext containing a HttpHandlerRequest and HttpHandlerRoute
   */
  async handle(context: HttpHandlerContext): Promise<HttpHandlerResponse> {

    const request = context.request;
    const path = request.url.pathname;

    const pathSegments = path.split('#')[0].split('?')[0].split('/').slice(1);

    this.logger.debug('Finding route for path: ', { path });

    // Find a matching route
    const match = Array.from(this.pathToRouteMap.keys()).find((route) => {

      // Route starts with a '/' so the first segment is always empty.
      const routeSegments = route.split('/').slice(1);

      // If there are different numbers of segments, then the route does not match the URL.
      if (routeSegments.length !== pathSegments.length) return false;

      // If each segment in the url matches the corresponding segment in the route path,
      // or the route path segment starts with a ':' then the route is matched.
      return routeSegments.every((seg, i) => seg === pathSegments[i] || seg[0] === ':');

    });

    this.logger.debug('Route matched:', { path, match: match ?? 'none' });

    const matchingRoutes = match ? this.pathToRouteMap.get(match) : undefined;

    if (matchingRoutes?.length) {

      const matchingRouteWithOperation = matchingRoutes
        .map((r) => ({ ... r, operation: r.route.operations.find((op) => op.method === request.method) }))
        .find((r) => r.operation);

      const allowedMethods = matchingRoutes.flatMap((r) => r.route.operations.map((op) => op.method));

      if (!matchingRouteWithOperation) {

        this.logger.info(`Operation not supported. Supported operations:`, { allowedMethods });

        return {
          status: request.method === 'OPTIONS' ? 204 : 405,
          headers: { 
            'allow': allowedMethods.join(', ')
          }, 
          body: '', 
        };
      }

      // Add the route's path to the logger's variables
      this.logger.setVariable('route', matchingRouteWithOperation.route.path);

      // add parameters from requestPath to the request object
      const paramNames = matchingRouteWithOperation.route.path.split('/').slice(1);
      const parameters = this.extractParameters(paramNames, pathSegments);
      this.logger.debug('Extracted parameters from path: ', { parameters });
      const requestWithParams = Object.assign(request, { parameters });
      const newContext = { ... context, request: requestWithParams, route: matchingRouteWithOperation.route };
      const preResponseHandler = matchingRouteWithOperation.controller.preResponseHandler;

      const preResponse = preResponseHandler ? await preResponseHandler.handle(newContext) : newContext;
      const response = await matchingRouteWithOperation.route.handler.handle(preResponse);
      
      return {
        ... response,
        headers: {
          ... response.headers,
          ... (request.method === 'OPTIONS') && { Allow: allowedMethods.join(', ') },
          ... (matchingRouteWithOperation.operation?.vary) && { 
            vary: matchingRouteWithOperation.operation.vary.join(', ') 
          },
        },
      };

    } else if (this.defaultHandler) {

      this.logger.info('No matching route found, calling default handler.', { path });

      return this.defaultHandler.handle(context);

    } else {

      this.logger.error('No matching route found.', { path });

      return { body: '', headers: {}, status: 404 };
    }

  }

  private extractParameters(routeSegments: string[], pathSegments: string[]): { [key: string]: string } {

    const parameters: { [key: string]: string } = {};

    routeSegments.forEach((segment, i) => {

      if (segment[0] === ':') {

        const propName = segment.slice(1); // Cut ':'
        parameters[propName] = decodeURIComponent(pathSegments[i]);

      }

    });

    return parameters;

  }

}
