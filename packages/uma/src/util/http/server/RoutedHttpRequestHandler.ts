import { getLoggerFor } from '@solid/community-server';
import Template from 'uri-template-lite';
import { HttpHandler } from '../models/HttpHandler';
import { HttpHandlerContext } from '../models/HttpHandlerContext';
import { HttpHandlerResponse } from '../models/HttpHandlerResponse';
import { HttpHandlerRoute } from '../models/HttpHandlerRoute';

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

  protected readonly routeMap: Map<Template, HttpHandlerRoute>;
  protected readonly logger = getLoggerFor(this);

  /**
   * Creates a RoutedHttpRequestHandler, super calls the HttpHandler class and expects a list of HttpHandlerControllers.
   */
  constructor(
    routes: HttpHandlerRoute[],
    protected readonly defaultHandler?: HttpHandler,
    onlyMatchTail = false,
  ) {
    super();

    this.routeMap = new Map();
    for (const route of routes) {
      // Add a catchall variable to the front if only the URL tail needs to be matched.
      this.routeMap.set(new Template(onlyMatchTail ? `{_prefix}${route.path}` : route.path), route);
    }
  }

  async handle(context: HttpHandlerContext): Promise<HttpHandlerResponse> {
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
      if (this.defaultHandler) {
        this.logger.info(`No matching route found, calling default handler. ${path}`);
        return this.defaultHandler.handle(context);
      } else {
        this.logger.error(`No matching route found. ${path}`);
        return { body: '', headers: {}, status: 404 };
      }
    }

    this.logger.debug(`Route matched: ${JSON.stringify({ path, parameters: match.parameters })}`);

    if (match.route.methods && !match.route.methods.includes(request.method)) {
      this.logger.info(`Operation not supported. Supported operations: ${ match.route.methods }`);
      return {
        status: 405,
        headers: { 'allow': match.route.methods.join(', ') },
        body: '',
      };
    }
    request.parameters = { ...request.parameters, ...match.parameters };

    return match.route.handler.handle(context);
  }
}
