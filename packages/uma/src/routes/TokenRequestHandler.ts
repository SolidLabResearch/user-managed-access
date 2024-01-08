import {UnsupportedMediaTypeHttpError} from '../http/errors/UnsupportedMediaTypeHttpError';
import {BadRequestHttpError} from '../http/errors/BadRequestHttpError';
import {HttpHandler} from '../http/models/HttpHandler';
import {HttpHandlerContext} from '../http/models/HttpHandlerContext';
import {HttpHandlerResponse} from '../http/models/HttpHandlerResponse';
import {GrantProcessor} from '../grant/GrantProcessor';

const GRANT_TYPE = 'grant_type';
/**
 * The Token Request Handler implements the interface of the OAuth/UMA Token Endpoint
 * using application/x-www-form-urlencoded as a serialization for the POST body.
 */
export class TokenRequestHandler implements HttpHandler {
  private readonly grantProcessors: Map<string, GrantProcessor>;

  /**
   * The Token Request Handler implements the interface of the OAuth/UMA Token Endpoint
   * using application/x-www-form-urlencoded as a serialization for the POST body.
   * @param {GrantProcessor[]} processors - a list of Grant Type Processors.
   */
  constructor(processors: GrantProcessor[]) {
    this.grantProcessors = new Map();
    processors.forEach((value) => this.grantProcessors.set(value.getSupportedGrantType(), value));
  }

  /**
   * Handles an incoming token request.
   *
   * @param {HttpHandlerContext} input - Request context
   * @return {Observable<HttpHandlerResponse<any>>} - response
   */
  async handle(input: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    if (input.request.headers['content-type'] !== 'application/x-www-form-urlencoded') {
      throw new UnsupportedMediaTypeHttpError();
    }

    const bodyParams = new URLSearchParams(input.request.body);

    if (!bodyParams.has(GRANT_TYPE) || !bodyParams.get(GRANT_TYPE)) {
      throw new BadRequestHttpError('Request body is missing required key \'grant_type\'.');
    }
    const grantType = bodyParams.get(GRANT_TYPE)!;

    const parsedRequestBody = new Map<string, string>();
    bodyParams.forEach((value, key) => {
      parsedRequestBody.set(key, value);
    });

    if (!this.grantProcessors.has(grantType)) {
      throw new BadRequestHttpError(`Unsupported grant type: '${grantType}'`);
    }

    const grantProcessor = this.grantProcessors.get(grantType)!;

    const tokenResponse = await grantProcessor.process(parsedRequestBody, input);

    return {body: JSON.stringify(tokenResponse), headers: {'content-type': 'application/json'}, status: 200};
  }
}


