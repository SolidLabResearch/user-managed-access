import {
  BadRequestHttpError,
  ForbiddenHttpError,
  getLoggerFor,
  UnsupportedMediaTypeHttpError
} from '@solid/community-server';
import { HttpHandler } from '../util/http/models/HttpHandler';
import { HttpHandlerContext } from '../util/http/models/HttpHandlerContext';
import { HttpHandlerResponse } from '../util/http/models/HttpHandlerResponse';
import { Negotiator } from '../dialog/Negotiator';
import { DialogInput } from '../dialog/Input';
import { reType } from '../util/ReType';
import { NeedInfoError } from '../errors/NeedInfoError';

/**
 * The TokenRequestHandler implements the interface of the UMA Token Endpoint.
 */
export class TokenRequestHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  constructor(
    protected negotiator: Negotiator,
  ) {
    super();
  }

  /**
   * Handles an incoming token request.
   *
   * @param {HttpHandlerContext} input - Request context
   * @return {Observable<HttpHandlerResponse<any>>} - response
   */
  async handle(input: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    this.logger.info(`Received token request.`);

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
