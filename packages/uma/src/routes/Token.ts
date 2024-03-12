import { UnsupportedMediaTypeHttpError } from '../util/http/errors/UnsupportedMediaTypeHttpError';
import { BadRequestHttpError } from '../util/http/errors/BadRequestHttpError';
import { HttpHandler } from '../util/http/models/HttpHandler';
import { HttpHandlerContext } from '../util/http/models/HttpHandlerContext';
import { HttpHandlerResponse } from '../util/http/models/HttpHandlerResponse';
import { Negotiator } from '../dialog/Negotiator';
import { Logger } from '../util/logging/Logger';
import { getLoggerFor } from '../util/logging/LoggerUtils';
import { DialogInput } from '../dialog/Input';
import { reType } from '../util/ReType';
import { NeedInfoError } from '../errors/NeedInfoError';
import { ForbiddenHttpError } from '../util/http/errors/ForbiddenHttpError';

/**
 * The TokenRequestHandler implements the interface of the UMA Token Endpoint.
 */
export class TokenRequestHandler implements HttpHandler {
  protected readonly logger: Logger = getLoggerFor(this);

  constructor(
    protected negotiator: Negotiator,
  ) {}

  /**
   * Handles an incoming token request.
   *
   * @param {HttpHandlerContext} input - Request context
   * @return {Observable<HttpHandlerResponse<any>>} - response
   */
  async handle(input: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    this.logger.info('Received token request.', input);

    // This deviates from UMA, which reads application/x-www-form-urlencoded
    if (input.request.headers['content-type'] !== 'application/json') { 
      throw new UnsupportedMediaTypeHttpError();
    }

    const params = input.request.body;

    // if (params['grant_type'] !== 'urn:ietf:params:oauth:grant-type:uma-ticket') {
    //   throw new BadRequestHttpError(
    //     `Expected 'grant_type' to be set to 'urn:ietf:params:oauth:grant-type:uma-ticket'
    //   `);
    // }

    try {
      reType(params, DialogInput);
    } catch (e) {
      throw new BadRequestHttpError(`Invalid token request body: ${e instanceof Error ? e.message : ''}`);
    }

    try {
      const tokenResponse = await this.negotiator.negotiate(params);

      return {
        status: 200,
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(tokenResponse)
      };
    } catch (e) {
      if (ForbiddenHttpError.isInstance(e)) return ({
        status: 403,
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          ticket: (e as NeedInfoError).ticket,
          ...(e as NeedInfoError).additionalParams
        })
      });
      throw e; // TODO: distinguish other errors
    }
  }
}


