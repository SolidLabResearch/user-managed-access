import { BadRequestHttpError, } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { DialogInput } from '../dialog/Input';
import { Negotiator } from '../dialog/Negotiator';
import { NeedInfoError } from '../errors/NeedInfoError';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';
import { reType } from '../util/ReType';
import { UMA_PROTECTION_SCOPE } from './token/UmaProtection';

export const GRANT_TYPE_UMA_TICKET = 'urn:ietf:params:oauth:grant-type:uma-ticket';

/**
 * The TokenRequestHandler implements the interface of the UMA Token Endpoint.
 */
export class TokenRequestHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  constructor(
    protected negotiator: Negotiator,
    protected readonly umaProtection: HttpHandler,
    protected readonly refreshTokenHandler: HttpHandler,
  ) {
    super();
  }

  public async handle(input: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    this.logger.info(`Received token request.`);
    const params = input.request.body;

    try {
      reType(params, DialogInput);
    } catch (e) {
      throw new BadRequestHttpError(`Invalid token request body: ${e instanceof Error ? e.message : ''}`);
    }

    if (params.scope === UMA_PROTECTION_SCOPE) {
      return this.umaProtection.handleSafe(input);
    }

    switch (params.grant_type) {
      case 'refresh_token': return this.refreshTokenHandler.handleSafe(input);
      case GRANT_TYPE_UMA_TICKET: return this.handleUmaGrant(params);
      default: throw new BadRequestHttpError(`Unsupported grant_type ${params.grant_type}`);
    }
  }

  protected async handleUmaGrant(params: DialogInput): Promise<HttpHandlerResponse<any>> {
    try {
      const tokenResponse = await this.negotiator.negotiate(params);

      return {
        status: 200,
        body: tokenResponse
      };
    } catch (e) {
      if (NeedInfoError.isInstance(e)) return ({
        status: 403,
        body: {
          ticket: e.ticket,
          ...e.additionalParams
        }
      });
      throw e; // TODO: distinguish other errors
    }
  }
}
