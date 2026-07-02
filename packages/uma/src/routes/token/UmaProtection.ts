import {
  BadRequestHttpError,
  createErrorMessage,
  ForbiddenHttpError,
  IndexedStorage,
  JwkGenerator,
  matchesAuthorizationScheme,
  TypeObject,
  UnauthorizedHttpError
} from '@solid/community-server';
import { importJWK, SignJWT } from 'jose';
import ms, { StringValue } from 'ms';
import { randomUUID } from 'node:crypto';
import { DialogInput } from '../../dialog/Input';
import { DialogOutput } from '../../dialog/Output';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../../util/http/models/HttpHandler';
import { reType } from '../../util/ReType';
import { CLIENT_REGISTRATION_STORAGE_DESCRIPTION, CLIENT_REGISTRATION_STORAGE_TYPE } from '../ClientRegistration';

const GRANT_TYPE_CLIENT_CREDENTIALS = 'client_credentials';
const GRANT_TYPE_REFRESH_TOKEN = 'refresh_token';

export const UMA_PROTECTION_SCOPE = 'uma_protection';

export const PAT_STORAGE_TYPE = 'pat';
export const PAT_STORAGE_DESCRIPTION = {
  pat: 'string',
  expiration: 'number',
  refreshToken: 'string',
  registration: `id:${CLIENT_REGISTRATION_STORAGE_TYPE}`,
} as const;

type Registration = TypeObject<typeof CLIENT_REGISTRATION_STORAGE_DESCRIPTION>;

/**
 * Handles the requests related to the UMA protection API, including generating and refreshing PATs.
 */
export class UmaProtection extends HttpHandler {
  protected readonly tokenExpiration: number;
  private readonly storage: IndexedStorage<{
    [CLIENT_REGISTRATION_STORAGE_TYPE]: typeof CLIENT_REGISTRATION_STORAGE_DESCRIPTION,
    [PAT_STORAGE_TYPE]: typeof PAT_STORAGE_DESCRIPTION,
  }>;

  constructor(
    storage: IndexedStorage<Record<string, never>>,
    protected readonly keyGen: JwkGenerator,
    protected readonly baseUrl: string,
    tokenExpiration: string = '30m',
  ) {
    super();
    this.tokenExpiration = Math.floor(ms(tokenExpiration as StringValue) / 1000);
    this.storage = storage;
    this.initializeStorage();
  }

  protected async initializeStorage(): Promise<void> {
    await this.storage.defineType(PAT_STORAGE_TYPE, PAT_STORAGE_DESCRIPTION);
    await this.storage.createIndex(PAT_STORAGE_TYPE, 'refreshToken');
    await this.storage.createIndex(PAT_STORAGE_TYPE, 'pat');
    await this.storage.createIndex(PAT_STORAGE_TYPE, 'registration');
  }

  public async handle(input: HttpHandlerContext): Promise<HttpHandlerResponse<DialogOutput>> {
    const params = input.request.body;

    try {
      reType(params, DialogInput);
    } catch (e) {
      throw new BadRequestHttpError(`Invalid token request body: ${createErrorMessage(e)}`);
    }

    if (params.scope !== UMA_PROTECTION_SCOPE) {
      throw new BadRequestHttpError(`Expected scope '${UMA_PROTECTION_SCOPE}'`);
    }

    const authorization = input.request.headers.authorization;

    switch (params.grant_type) {
      case GRANT_TYPE_CLIENT_CREDENTIALS: return this.handleClientCredentials(authorization);
      case GRANT_TYPE_REFRESH_TOKEN: return this.handleRefreshToken(params.refresh_token, authorization);
      default: throw new BadRequestHttpError(`Unsupported grant_type ${params.grant_type}`);
    }
  }

  protected async handleClientCredentials(authorization?: string): Promise<HttpHandlerResponse<DialogOutput>> {
    const registration = await this.findRegistration(authorization);
    const matches = await this.storage.findIds(PAT_STORAGE_TYPE, { registration: registration.id });
    return {
      status: 201,
      body: await this.generateToken(registration, matches.length > 0 ? matches[0] : undefined),
    };
  }

  protected async handleRefreshToken(refreshToken?: string, authorization?: string):
    Promise<HttpHandlerResponse<DialogOutput>> {
    if (!refreshToken) {
      throw new BadRequestHttpError(`Missing refresh_token parameter`);
    }

    const pats = await this.storage.find(PAT_STORAGE_TYPE, { refreshToken });
    if (pats.length === 0) {
      throw new ForbiddenHttpError(`Unknown refresh token ${refreshToken}`);
    }

    const registration = await this.findRegistration(authorization);
    if (registration.id !== pats[0].registration) {
      throw new ForbiddenHttpError(`Wrong credentials for refresh token ${refreshToken}`);
    }

    return {
      status: 201,
      body: await this.generateToken(registration, pats[0].id),
    };
  }

  protected async findRegistration(authorization?: string): Promise<Registration> {
    if (typeof authorization !== 'string') {
      throw new UnauthorizedHttpError();
    }
    if (!matchesAuthorizationScheme('Basic', authorization)) {
      throw new BadRequestHttpError(`Expected scheme 'Basic'`);
    }

    const decoded = Buffer.from(authorization.split(' ')[1], 'base64').toString('utf8');
    const [ id, secret ] = decoded.split(':');
    const match = await this.storage.find(
      CLIENT_REGISTRATION_STORAGE_TYPE,
      { clientId: decodeURIComponent(id), clientSecret: decodeURIComponent(secret ?? '') }
    );
    if (match.length === 0) {
      throw new ForbiddenHttpError();
    }
    return match[0];
  }

  protected async generateToken(registration: Registration, id?: string): Promise<DialogOutput> {
    const refresh_token = randomUUID();
    const expiration = Date.now() + this.tokenExpiration * 1000;
    const key = await this.keyGen.getPrivateKey();
    const jwk = await importJWK(key, key.alg);
    const pat = await new SignJWT({
      scope: UMA_PROTECTION_SCOPE,
      azp: registration.clientId,
      client_id: registration.clientId
    }).setProtectedHeader({ alg: key.alg, kid: key.kid })
      .setIssuedAt()
      .setSubject(registration.userId)
      .setIssuer(this.baseUrl)
      .setAudience(this.baseUrl)
      .setExpirationTime(Math.floor(expiration / 1000))
      .setJti(randomUUID())
      .sign(jwk);

    const body = { pat, refreshToken: refresh_token, expiration, registration: registration.id };
    if (id) {
      await this.storage.set(PAT_STORAGE_TYPE, { id, ...body });
    } else {
      await this.storage.create(PAT_STORAGE_TYPE, body);
    }

    return {
      access_token: pat,
      refresh_token,
      token_type: 'Bearer',
      expires_in: this.tokenExpiration,
    };
  }
}
