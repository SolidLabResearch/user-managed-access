import {
  APPLICATION_JSON,
  APPLICATION_LD_JSON,
  APPLICATION_X_WWW_FORM_URLENCODED,
  getConversionTarget,
  InternalServerError,
  NotImplementedHttpError,
  parseAccept,
  parseContentType,
  UnsupportedMediaTypeHttpError,
  ValuePreferences
} from '@solid/community-server';
import { formToJson, jsonToForm } from '../../ConvertUtil';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../models/HttpHandler';

/**
 * A {@link HttpHandler} that takes raw Buffer data from a request and converts it into a usable object,
 * to be used by the source handler.
 * The response then gets converted back to a Buffer.
 * Supports JSON and x-www-form-urlencoded input bodies.
 */
export class JsonFormHttpHandler extends HttpHandler<HttpHandlerContext<Buffer>, Buffer> {
  protected readonly cache: WeakMap<HttpHandlerContext, { context: HttpHandlerContext }>

  public constructor(
    protected readonly handler: HttpHandler,
  ) {
    super();
    this.cache = new WeakMap();
  }

  public async canHandle(context: HttpHandlerContext<Buffer>): Promise<void> {
    let body: unknown;
    if (context.request.body) {
      const contentType = parseContentType(context.request.headers['content-type']);
      if (contentType.value === APPLICATION_X_WWW_FORM_URLENCODED) {
        body = formToJson(context.request.body.toString());
      } else if (contentType.value === APPLICATION_JSON || contentType.value === APPLICATION_LD_JSON) {
        body = JSON.parse(context.request.body.toString());
      } else {
        throw new UnsupportedMediaTypeHttpError('Only JSON and urlencoded bodies are accepted.');
      }
    }

    const parsedContext: HttpHandlerContext = body ? {
      ...context,
      request: {
        ...context.request,
        body
      }
    } : context;

    await this.handler.canHandle(parsedContext);

    this.cache.set(context, { context: parsedContext });
  }

  public async handle(context: HttpHandlerContext<Buffer>): Promise<HttpHandlerResponse<Buffer>> {
    const cached = this.cache.get(context);
    if (!cached) {
      throw new InternalServerError('Calling handle before calling canHandle.');
    }

    const response = await this.handler.handle(cached.context);

    if (!response.body) {
      return response as HttpHandlerResponse<never>;
    }

    let responseData: Buffer | undefined;
    let outputType = response.headers?.['content-type'];
    if (outputType) {
      if (typeof response.body === 'string') {
        responseData = Buffer.from(response.body, 'utf8');
      } else if (Buffer.isBuffer(response.body)) {
        responseData = response.body;
      }
    }

    // No content type given by handler, so assume it is a JSON object
    if (!outputType) {
      // Determine what to return based on the accept header
      let preferences: ValuePreferences = {};
      const acceptHeader = context.request.headers['accept'];
      if (acceptHeader) {
        preferences = Object.fromEntries(parseAccept(acceptHeader)
          .map(({ range, weight }): [string, number] => [ range, weight ]));
      }
      outputType = getConversionTarget(
        { [APPLICATION_JSON]: 1, [APPLICATION_X_WWW_FORM_URLENCODED]: 0.9 },
        preferences,
      );
      if (!outputType) {
        throw new NotImplementedHttpError('Unable to convert output to JSON or urlencoded data.');
      }

      responseData = Buffer.from(outputType === APPLICATION_JSON ?
        JSON.stringify(response.body) :
        jsonToForm(response.body));
    }

    // TS does not realize that this has the correct body type
    return {
      ...response,
      ...responseData && { body: responseData },
      headers: {
        ...response.headers,
        ...responseData && { 'content-type': outputType },
      }
    } as HttpHandlerResponse<Buffer>;
  }
}
