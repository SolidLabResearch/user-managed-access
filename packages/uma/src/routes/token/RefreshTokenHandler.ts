import {
  BadRequestHttpError,
  ForbiddenHttpError,
  KeyValueStorage,
} from '@solid/community-server';
import { REFRESH_TOKEN } from '../../credentials/Formats';
import { RefreshInformation } from '../../credentials/verify/RefreshTokenVerifier';
import { Negotiator } from '../../dialog/Negotiator';
import { DialogInput } from '../../dialog/Input';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../../util/http/models/HttpHandler';
import { reType } from '../../util/ReType';

/**
 * Handles refresh token requests.
 */
export class RefreshTokenHandler extends HttpHandler {
  public constructor(
    protected readonly refreshStore: KeyValueStorage<string, RefreshInformation>,
    protected readonly negotiator: Negotiator,
  ) {
    super();
  }

  public async handle(input: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    const params = input.request.body;

    try {
      reType(params, DialogInput);
    } catch (e) {
      throw new BadRequestHttpError(`Invalid token request body: ${e instanceof Error ? e.message : ''}`);
    }

    if (params.grant_type !== 'refresh_token') {
      throw new BadRequestHttpError(`Unsupported grant_type ${params.grant_type}`);
    }

    if (!params.refresh_token) {
      throw new BadRequestHttpError(`Missing refresh_token parameter`);
    }

    const information = await this.refreshStore.get(params.refresh_token);
    if (!information) {
      throw new BadRequestHttpError(`Refresh token ${params.refresh_token} not recognized.`);
    }
    if (Date.now() > information.expiration) {
      await this.refreshStore.delete(params.refresh_token);
      throw new ForbiddenHttpError(`Expired refresh token ${params.refresh_token}`);
    }

    const tokenResponse = await this.negotiator.negotiate({
      permissions: information.permissions,
      claim_token: params.refresh_token,
      claim_token_format: REFRESH_TOKEN,
    });

    await this.refreshStore.delete(params.refresh_token);

    return {
      status: 200,
      body: tokenResponse,
    };
  }
}
