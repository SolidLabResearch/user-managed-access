import {
  BadRequestHttpError,
  ConflictHttpError,
  IndexedStorage, InternalServerError,
  joinUrl,
  MemoryMapStorage,
  NotFoundHttpError,
  UnauthorizedHttpError,
  WrappedIndexedStorage
} from '@solid/community-server';
import { Mocked } from 'vitest';
import { WEBID } from '../../../src/credentials/Claims';
import { CredentialParser } from '../../../src/credentials/CredentialParser';
import { Verifier } from '../../../src/credentials/verify/Verifier';
import ClientRegistrationRequestHandler, {
  CLIENT_REGISTRATION_STORAGE_DESCRIPTION,
  CLIENT_REGISTRATION_STORAGE_TYPE
} from '../../../src/routes/ClientRegistration';
import { HttpHandlerRequest } from '../../../src/util/http/models/HttpHandler';
import * as crypto from 'node:crypto';

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(),
  randomBytes: vi.fn(),
}));

describe('ClientRegistration', (): void => {
  const token = 'token';
  const format = 'format';
  const webId = 'webId';
  let request: HttpHandlerRequest;
  let credentialParser: Mocked<CredentialParser>;
  let verifier: Mocked<Verifier>;
  let storage: Mocked<IndexedStorage<{
    [CLIENT_REGISTRATION_STORAGE_TYPE]: typeof CLIENT_REGISTRATION_STORAGE_DESCRIPTION,
  }>>;
  let handler: ClientRegistrationRequestHandler;

  beforeEach(async(): Promise<void> => {
    request = {
      method: 'GET',
    } satisfies Partial<HttpHandlerRequest> as any;

    credentialParser = {
      handleSafe: vi.fn().mockResolvedValue({ token, format }),
    } satisfies Partial<CredentialParser> as any;

    verifier = {
      verify: vi.fn().mockResolvedValue({ [WEBID]: webId }),
    };

    storage = {
      defineType: vi.fn(),
      createIndex: vi.fn(),
      find: vi.fn(),
      findIds: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    } as any;

    handler = new ClientRegistrationRequestHandler(credentialParser, verifier, storage as any);
  });

  it('errors if no valid credentials are provided.', async(): Promise<void> => {
    verifier.verify.mockResolvedValueOnce({});
    await expect(handler.handle({ request })).rejects.toThrow(UnauthorizedHttpError);
  });

  it('returns all registered clients on GET requests.', async(): Promise<void> => {
    storage.find.mockResolvedValueOnce([
      { clientName: 'client1', clientUri: 'uri1', clientId: 'id1', clientSecret: 'secret1', userId: webId },
      { clientUri: 'uri2', clientId: 'id2', clientSecret: 'secret2', userId: webId },
    ]);
    await expect(handler.handle({ request })).resolves.toEqual({
      status: 200,
      body: [
        { name: 'client1', uri: 'uri1', id: 'id1' },
        { uri: 'uri2', id: 'id2' },
      ]
    });
  });

  it('registers a client on POST requests.', async(): Promise<void> => {
    request.method = 'POST';
    request.body = {
      client_name: 'name',
      client_uri: 'uri',
    };
    request.url = new URL('http://example.com/');

    storage.findIds.mockResolvedValueOnce([]);
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('0000-1111-2222-3333-4444');
    vi.spyOn(crypto, 'randomBytes').mockReturnValueOnce(Buffer.from('abc') as any);

    await expect(handler.handle({ request })).resolves.toEqual({
      status: 201,
      headers: { location: `http://example.com/0000-1111-2222-3333-4444` },
      body: {
        client_uri: 'uri',
        client_name: 'name',
        client_id: '0000-1111-2222-3333-4444',
        client_secret: '616263',
        client_secret_expires_at: '0',
        grant_types: [ 'client_credentials', 'refresh_token' ],
        token_endpoint_auth_method: 'client_secret_basic',
      }
    });
    expect(storage.findIds).toHaveBeenCalledTimes(1);
    expect(storage.findIds).toHaveBeenLastCalledWith(
      CLIENT_REGISTRATION_STORAGE_TYPE, { userId: webId, clientUri: 'uri' });
    expect(storage.create).toHaveBeenCalledTimes(1);
    expect(storage.create).toHaveBeenLastCalledWith(CLIENT_REGISTRATION_STORAGE_TYPE, {
      userId: webId,
      clientUri: 'uri',
      clientName: 'name',
      clientId: '0000-1111-2222-3333-4444',
      clientSecret: '616263',
    });
  });

  it('allows multiple registrations for the same owner when client_uri differs.', async(): Promise<void> => {
    const realStorage = new WrappedIndexedStorage(new MemoryMapStorage(), new MemoryMapStorage());
    const realHandler = new ClientRegistrationRequestHandler(credentialParser, verifier, realStorage as any);
    await new Promise((resolve) => setImmediate(resolve));

    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('0000-1111-2222-3333-4444')
      .mockReturnValueOnce('4444-3333-2222-1111-0000');
    vi.spyOn(crypto, 'randomBytes')
      .mockReturnValueOnce(Buffer.from('abc') as any)
      .mockReturnValueOnce(Buffer.from('def') as any);

    const firstRequest = {
      method: 'POST',
      url: new URL('http://example1.com/'),
      body: {
        client_name: 'rs-1',
        client_uri: 'http://example1.com/',
      },
    } satisfies Partial<HttpHandlerRequest> as HttpHandlerRequest;

    await expect(realHandler.handle({ request: firstRequest })).resolves.toMatchObject({ status: 201 });

    const secondRequest = {
      method: 'POST',
      url: new URL('http://example2.com/'),
      body: {
        client_name: 'rs-2',
        client_uri: 'http://example2.com/',
      },
    } satisfies Partial<HttpHandlerRequest> as HttpHandlerRequest;

    await expect(realHandler.handle({ request: secondRequest })).resolves.toMatchObject({ status: 201 });
  });

  it('requires valid input when registering.', async(): Promise<void> => {
    request.method = 'POST';
    request.body = {};
    await expect(handler.handle({ request })).rejects.toThrow(BadRequestHttpError);
    expect(storage.create).toHaveBeenCalledTimes(0);
  });

  it('errors if a client is already registered.', async(): Promise<void> => {
    request.method = 'POST';
    request.body = {
      client_name: 'name',
      client_uri: 'uri',
    };
    storage.findIds.mockResolvedValueOnce([ 'match' ]);
    await expect(handler.handle({ request })).rejects.toThrow(ConflictHttpError);
    expect(storage.create).toHaveBeenCalledTimes(0);
  });

  it('can remove a registration on DELETE requests.', async(): Promise<void> => {
    request.method = 'DELETE';
    request.parameters = { id: 'id' };
    storage.findIds.mockResolvedValueOnce([ 'match' ]);

    await expect(handler.handle({ request })).resolves.toEqual({ status: 204 });
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenLastCalledWith(CLIENT_REGISTRATION_STORAGE_TYPE, 'match');
  });

  it('errors if there is no ID when deleting.', async(): Promise<void> => {
    request.method = 'DELETE';
    request.parameters = {};
    storage.findIds.mockResolvedValueOnce([ 'match' ]);

    await expect(handler.handle({ request })).rejects.toThrow(InternalServerError);
    expect(storage.delete).toHaveBeenCalledTimes(0);
  });

  it('errors if the ID is unknown when deleting.', async(): Promise<void> => {
    request.method = 'DELETE';
    request.parameters = { id: 'id' };
    storage.findIds.mockResolvedValueOnce([]);

    await expect(handler.handle({ request })).rejects.toThrow(NotFoundHttpError);
    expect(storage.delete).toHaveBeenCalledTimes(0);
  });
});
