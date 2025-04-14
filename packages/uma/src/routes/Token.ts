import { BadRequestHttpError, ForbiddenHttpError, getLoggerFor } from '@solid/community-server';
import { DialogInput } from '../dialog/Input';
import { Negotiator } from '../dialog/Negotiator';
import { NeedInfoError } from '../errors/NeedInfoError';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';
import { reType } from '../util/ReType';

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

  async handle(input: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    this.logger.info(`Received token request.`);
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
        body: tokenResponse
      };
    } catch (e) {
      if (ForbiddenHttpError.isInstance(e)) return ({
        status: 403,
        body: {
          ticket: (e as NeedInfoError).ticket,
          ...(e as NeedInfoError).additionalParams
        }
      });
      throw e; // TODO: distinguish other errors
    }
  }
}
