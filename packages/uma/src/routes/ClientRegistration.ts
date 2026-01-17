import {
  BadRequestHttpError,
  ConflictHttpError,
  createErrorMessage,
  IndexedStorage,
  InternalServerError,
  joinUrl,
  MethodNotAllowedHttpError,
  NotFoundHttpError,
  UnauthorizedHttpError
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { randomBytes, randomUUID } from 'node:crypto';
import { WEBID } from '../credentials/Claims';
import { CredentialParser } from '../credentials/CredentialParser';
import { Verifier } from '../credentials/verify/Verifier';
import {
  HttpHandler,
  HttpHandlerContext,
  HttpHandlerRequest,
  HttpHandlerResponse
} from '../util/http/models/HttpHandler';
import { optional as $, reType, string, Type } from '../util/ReType';

export const ClientRegistrationInput = {
  client_name: $(string),
  client_uri: string,
};

export type ClientRegistrationInput = Type<typeof ClientRegistrationInput>;

export const CLIENT_REGISTRATION_STORAGE_TYPE = 'clientRegistration';
export const CLIENT_REGISTRATION_STORAGE_DESCRIPTION = {
  clientName: 'string?',
  clientUri: 'string',
  clientId: 'string',
  clientSecret: 'string',
  userId: 'string',
} as const;

/**
 * Allows the registration of clients.
 * This is part of the PAT story.
 * The idea is that a user registers their RS through this API,
 * and then passes the resulting id and secret to the RS to be used for PAT generation.
 */
export class ClientRegistrationRequestHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);
  private readonly storage: IndexedStorage<{
    [CLIENT_REGISTRATION_STORAGE_TYPE]: typeof CLIENT_REGISTRATION_STORAGE_DESCRIPTION,
  }>;

  public constructor(
    protected readonly credentialParser: CredentialParser,
    protected readonly verifier: Verifier,
    storage: IndexedStorage<Record<string, never>>,
  ) {
    super();
    this.storage = storage;
    this.initializeStorage();
  }

  protected async initializeStorage(): Promise<void> {
    await this.storage.defineType(CLIENT_REGISTRATION_STORAGE_TYPE, CLIENT_REGISTRATION_STORAGE_DESCRIPTION);
    await this.storage.createIndex(CLIENT_REGISTRATION_STORAGE_TYPE, 'userId');
    await this.storage.createIndex(CLIENT_REGISTRATION_STORAGE_TYPE, 'clientUri');
    await this.storage.createIndex(CLIENT_REGISTRATION_STORAGE_TYPE, 'clientId');
  }

  public async handle({ request }: HttpHandlerContext): Promise<HttpHandlerResponse> {
    const credential = await this.credentialParser.handleSafe(request);
    const claims = await this.verifier.verify(credential);
    const userId = claims[WEBID];

    if (typeof userId !== 'string') {
      throw new UnauthorizedHttpError();
    }

    switch (request.method) {
      case 'GET': return this.getClients(request, userId);
      case 'POST': return this.registerClient(request, userId);
      case 'DELETE': return this.deleteClient(request, userId);
      default: throw new MethodNotAllowedHttpError([ request.method ]);
    }
  }

  protected async getClients(request: HttpHandlerRequest, userId: string): Promise<HttpHandlerResponse> {
    const results = await this.storage.find(CLIENT_REGISTRATION_STORAGE_TYPE, { userId });
    // Filter out secrets
    const body = results.map((result) => ({
      name: result.clientName,
      uri: result.clientUri,
      id: result.clientId,
    }));
    return {
      status: 200,
      body,
    };
  }

  protected async registerClient(request: HttpHandlerRequest, userId: string): Promise<HttpHandlerResponse> {
    try {
      reType(request.body, ClientRegistrationInput);
    } catch (e) {
      this.logger.warn(`Syntax error: ${createErrorMessage(e)}, ${request.body}`);
      throw new BadRequestHttpError(`Request has bad syntax: ${createErrorMessage(e)}`);
    }

    const match = await this.storage.findIds(
      CLIENT_REGISTRATION_STORAGE_TYPE, { userId, clientUri: request.body.client_uri });
    if (match.length > 0) {
    throw new ConflictHttpError(`${request.body.client_uri} is already registered for ${userId}`);
    }

    const clientId = randomUUID();
    const clientSecret = randomBytes(64).toString('hex');
    await this.storage.create(
      CLIENT_REGISTRATION_STORAGE_TYPE,
      {
        userId,
        clientUri: request.body.client_uri,
        clientName: request.body.client_name,
        clientId,
        clientSecret,
      }
    );

    return {
      status: 201,
      headers: { location: `${joinUrl(request.url.href, encodeURIComponent(clientId))}` },
      body: {
        client_uri: request.body.client_uri,
        client_name: request.body.client_name,
        client_id: clientId,
        client_secret: clientSecret,
        client_secret_expires_at: '0',
        grant_types: [ 'client_credentials', 'refresh_token' ],
        token_endpoint_auth_method: 'client_secret_basic',
      }
    }
  }

  protected async deleteClient(request: HttpHandlerRequest, userId: string): Promise<HttpHandlerResponse> {
    if (typeof request.parameters?.id !== 'string') {
      throw new InternalServerError('URI for DELETE operation should include an id.');
    }

    const matches = await this.storage.findIds(CLIENT_REGISTRATION_STORAGE_TYPE, { clientId: request.parameters.id });
    if (matches.length === 0) {
      throw new NotFoundHttpError();
    }

    await this.storage.delete(CLIENT_REGISTRATION_STORAGE_TYPE, matches[0]);

    return { status: 204 };
  }
}

export default ClientRegistrationRequestHandler
