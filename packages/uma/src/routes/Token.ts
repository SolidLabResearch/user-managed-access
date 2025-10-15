import {
  BadRequestHttpError,
  ForbiddenHttpError,
  IndexedStorage,
  JwkGenerator,
  matchesAuthorizationScheme,
  TypeObject,
  UnauthorizedHttpError
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { importJWK, SignJWT } from 'jose';
import ms, { StringValue } from 'ms';
import { randomUUID } from 'node:crypto';
import { DialogInput } from '../dialog/Input';
import { Negotiator } from '../dialog/Negotiator';
import { NeedInfoError } from '../errors/NeedInfoError';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';
import { reType } from '../util/ReType';
import { CLIENT_REGISTRATION_STORAGE_DESCRIPTION, CLIENT_REGISTRATION_STORAGE_TYPE } from './ClientRegistration';

export const GRANT_TYPE_CLIENT_CREDENTIALS = 'client_credentials';
export const GRANT_TYPE_REFRESH_TOKEN = 'refresh_token';
export const GRANT_TYPE_UMA_TICKET = 'urn:ietf:params:oauth:grant-type:uma-ticket';

export const PAT_STORAGE_TYPE = 'pat';
export const PAT_STORAGE_DESCRIPTION = {
  pat: 'string',
  expiration: 'number',
  refreshToken: 'string',
  registration: `id:${CLIENT_REGISTRATION_STORAGE_TYPE}`,
} as const;

/**
 * The TokenRequestHandler implements the interface of the UMA Token Endpoint.
 */
export class TokenRequestHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);
  protected readonly tokenExpiration: number;
  private readonly storage: IndexedStorage<{
    [CLIENT_REGISTRATION_STORAGE_TYPE]: typeof CLIENT_REGISTRATION_STORAGE_DESCRIPTION,
    [PAT_STORAGE_TYPE]: typeof PAT_STORAGE_DESCRIPTION,
  }>;

  constructor(
    protected negotiator: Negotiator,
    storage: IndexedStorage<Record<string, never>>,
    protected readonly keyGen: JwkGenerator,
    protected readonly baseUrl: string,
    tokenExpiration: string = '30m',
  ) {
    super();
    this.tokenExpiration = Math.floor(ms(tokenExpiration as StringValue)/1000);
    this.storage = storage;
    this.initializeStorage();
  }

  protected async initializeStorage(): Promise<void> {
    await this.storage.defineType(PAT_STORAGE_TYPE, PAT_STORAGE_DESCRIPTION);
    await this.storage.createIndex(PAT_STORAGE_TYPE, 'refreshToken');
    await this.storage.createIndex(PAT_STORAGE_TYPE, 'pat');
    await this.storage.createIndex(PAT_STORAGE_TYPE, 'registration');
  }

  public async handle(input: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    this.logger.info(`Received token request.`);
    const params = input.request.body;

    try {
      reType(params, DialogInput);
    } catch (e) {
      throw new BadRequestHttpError(`Invalid token request body: ${e instanceof Error ? e.message : ''}`);
    }

    switch (params.grant_type) {
      case GRANT_TYPE_CLIENT_CREDENTIALS: return this.handlePatRequest(params, input.request.headers.authorization);
      case GRANT_TYPE_REFRESH_TOKEN: return this.handleRefreshRequest(params, input.request.headers.authorization);
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

  protected async handlePatRequest(params: DialogInput, authorization?: string): Promise<HttpHandlerResponse<any>> {
    const registration = await this.handlePreliminaryPatChecks(params, authorization);
    // If there already is a stored token: reuse the ID
    const matches = await this.storage.findIds(PAT_STORAGE_TYPE, { registration: registration.id });
    return this.generateToken(registration, matches.length > 0 ? matches[0] : undefined);
  }

  protected async handleRefreshRequest(params: DialogInput, authorization?: string): Promise<HttpHandlerResponse<any>> {
    if (!params.refresh_token) {
      throw new BadRequestHttpError(`Missing refresh_token parameter`);
    }

    const pats = await this.storage.find(PAT_STORAGE_TYPE, { refreshToken: params.refresh_token });
    if (pats.length === 0) {
      throw new ForbiddenHttpError(`Unknown refresh token ${params.refresh_token}`);
    }
    const registration = await this.handlePreliminaryPatChecks(params, authorization);
    if (registration.id !== pats[0].registration) {
      throw new ForbiddenHttpError(`Wrong credentials for refresh token ${params.refresh_token}`);
    }

    return this.generateToken(registration, pats[0].id);
  }

  // Returns the UserId if there is a match, or throws an error
  protected async handlePreliminaryPatChecks(params: DialogInput, authorization?: string):
    Promise<TypeObject<typeof CLIENT_REGISTRATION_STORAGE_DESCRIPTION>> {
    if (typeof authorization !== 'string') {
      throw new UnauthorizedHttpError();
    }
    if (params.scope !== 'uma_protection') {
      throw new BadRequestHttpError(`Expected scope 'uma_protection'`);
    }
    if (!matchesAuthorizationScheme('Basic', authorization)) {
      throw new BadRequestHttpError(`Expected scheme 'Basic'`);
    }
    const decoded = Buffer.from(authorization.split(' ')[1], 'base64').toString('utf8');
    const [ id, secret ] = decoded.split(':');
    const match = await this.storage.find(CLIENT_REGISTRATION_STORAGE_TYPE,
      { clientId: decodeURIComponent(id), clientSecret: decodeURIComponent(secret ?? '') });
    if (match.length === 0) {
      throw new ForbiddenHttpError();
    }
    return match[0];
  }

  protected async generateToken(registration: TypeObject<typeof CLIENT_REGISTRATION_STORAGE_DESCRIPTION>, id?: string):
    Promise<HttpHandlerResponse<any>> {
    const refresh_token = randomUUID();
    const expiration = Date.now() + this.tokenExpiration * 1000;
    const key = await this.keyGen.getPrivateKey();
    const jwk = await importJWK(key, key.alg);
    const pat = await new SignJWT({
      scope: 'uma_protection',
      azp: registration.clientId,
      client_id: registration.clientId
    }).setProtectedHeader({ alg: key.alg, kid: key.kid })
      .setIssuedAt()
      .setSubject(registration.userId)
      .setIssuer(this.baseUrl)
      .setAudience(this.baseUrl)
      .setExpirationTime(Math.floor(expiration/1000))
      .setJti(randomUUID())
      .sign(jwk);

    const body = { pat, refreshToken: refresh_token, expiration, registration: registration.id };
    if (id) {
      await this.storage.set(PAT_STORAGE_TYPE, { id, ...body });
    } else {
      await this.storage.create(PAT_STORAGE_TYPE, body);
    }

    return {
      status: 201,
      body: {
        access_token: pat,
        refresh_token,
        token_type: 'Bearer',
        expires_in: this.tokenExpiration,
        scope: 'uma_protection',
      }
    }
  }
}
