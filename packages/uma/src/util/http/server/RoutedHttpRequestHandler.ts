import {
  getLoggerFor,
  InternalServerError,
  MethodNotAllowedHttpError,
  NotImplementedHttpError
} from '@solid/community-server';
import Template from 'uri-template-lite';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../models/HttpHandler';
import { HttpHandlerRoute } from '../models/HttpHandlerRoute';

type RouteMatch = { parameters: Record<string, string>, route: HttpHandlerRoute };

/**
 * A {@link HttpHandler} handling requests based on routes in a given list of {@link HttpHandlerRoute}s.
 * Route paths can contain variables as described in RFC 6570.
 * These will be added to the `parameters` object of the request.
 *
 * In case no route matches the request, the `defaultHandler` will be called, if there is one.
 *
 * Routes are matched to the URL path.
 * That is the part of the URL starting from the first slash after the domain.
 * This can be an issue in case your server is not running on the root of the server domain.
 * To work around this, `onlyMatchTail` can be set to true.
 * In that case only the tail of the URL will be matched to the template.
 * E.g., `http://example.com/foo/bar` will match the route template `/bar`.
 */
export class RoutedHttpRequestHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  protected readonly routeMap: Map<Template, HttpHandlerRoute>;
  protected readonly handledRequests: WeakMap<HttpHandlerContext, RouteMatch>;


  /**
   * Creates a RoutedHttpRequestHandler, super calls the HttpHandler class and expects a list of HttpHandlerControllers.
   */
  constructor(
    routes: HttpHandlerRoute[],
    onlyMatchTail = false,
  ) {
    super();

    this.routeMap = new Map();
    for (const route of routes) {
      // Add a catchall variable to the front if only the URL tail needs to be matched.
      this.routeMap.set(new Template(onlyMatchTail ? `{_prefix}${route.path}` : route.path), route);
    }
    this.handledRequests = new WeakMap();
  }

  public async canHandle(context: HttpHandlerContext): Promise<void> {
    const request = context.request;
    const path = request.url.pathname;

    this.logger.debug(`Finding route for path: ${ path }`);

    let match: { parameters: Record<string, string>, route: HttpHandlerRoute } | undefined;
    for (const [ template, route ] of this.routeMap) {
      const parameters = template.match(path);
      if (parameters) {
        match = { parameters, route };
        break;
      }
    }

    if (!match) {
      throw new NotImplementedHttpError();
    }

    this.logger.debug(`Route matched: ${JSON.stringify({ path, parameters: match.parameters })}`);

    if (match.route.methods && !match.route.methods.includes(request.method)) {
      this.logger.info(`Operation not supported. Supported operations: ${ match.route.methods }`);
      throw new MethodNotAllowedHttpError([ request.method ]);
    }
    this.handledRequests.set(context, match);
  }

  public async handle(context: HttpHandlerContext): Promise<HttpHandlerResponse> {
    const match = this.handledRequests.get(context);
    if (!match) {
      throw new InternalServerError('Calling handle without successful canHandle');
    }
    context.request.parameters = { ...context.request.parameters, ...match.parameters };

    return match.route.handler.handleSafe(context);
  }
}
