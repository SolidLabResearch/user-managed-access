import { BadRequestHttpError } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { TokenFactory } from '../tokens/TokenFactory';
import { AccessToken } from '../tokens/AccessToken';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';
import { RequestValidator } from '../util/http/validate/RequestValidator';
import { RegistrationStore } from '../util/RegistrationStore';

type IntrospectionResponse = {
  active : boolean,
  permissions?: {
    resource_id: string,
    resource_scopes: string[]
  }[],
  exp?: number,
  iat?: number,
  nbf?: number,
}

/**
 * An HTTP handler that provides introspection into opaque access tokens.
 */
export class IntrospectionHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  /**
   * Creates an introspection handler for tokens in the given token store.
   *
   * @param tokenFactory - The factory with which tokens were produced.
   * @param validator - Verifies the validity of the request.
   */
  constructor(
    private readonly tokenFactory: TokenFactory,
    private readonly validator: RequestValidator,
    private readonly registrationStore: RegistrationStore,
  ) {
    super();
  }

  public async handle({ request }: HttpHandlerContext): Promise<HttpHandlerResponse<IntrospectionResponse>> {
    await this.validator.handleSafe({ request });

    if (!request.body) {
      throw new BadRequestHttpError('Missing request body.');
    }

    const token = new URLSearchParams(request.body as Record<string, string>).get('token');
    try {
      if (!token) throw new Error('could not extract token from request body')
      const unsignedToken = await this.tokenFactory.deserialize(token);
      if (!await this.isActive(unsignedToken)) {
        return {
          status: 200,
          body: { active: false },
        };
      }
      return {
        status: 200,
        body: { ...unsignedToken, active: true },
      };
    } catch (e) {
      this.logger.warn(`Token introspection failed: ${e}`)
      return {
        status: 200,
        body: { active: false },
      };
    }
  }

  protected async isActive(token: AccessToken): Promise<boolean> {
    const issuedAt = token.issued_at ?? (token.iat ? token.iat * 1000 : undefined);
    for (const permission of token.permissions) {
      const registration = await this.registrationStore.get(permission.resource_id);
      if (!registration) {
        return false;
      }

      const updatedAt = Date.parse(registration.updatedAt ?? registration.registeredAt ?? '');
      if (issuedAt !== undefined && !Number.isNaN(updatedAt) && issuedAt < updatedAt) {
        return false;
      }
    }

    return true;
  }
}
