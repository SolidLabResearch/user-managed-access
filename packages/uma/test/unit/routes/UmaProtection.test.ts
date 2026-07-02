import {
  AlgJwk,
  ForbiddenHttpError,
  IndexedStorage,
  JwkGenerator,
  UnauthorizedHttpError
} from '@solid/community-server';
import { exportJWK, generateKeyPair, GenerateKeyPairResult, importJWK, jwtVerify } from 'jose';
import { beforeAll, Mocked } from 'vitest';
import {
  CLIENT_REGISTRATION_STORAGE_DESCRIPTION,
  CLIENT_REGISTRATION_STORAGE_TYPE
} from '../../../src/routes/ClientRegistration';
import {
  PAT_STORAGE_DESCRIPTION,
  PAT_STORAGE_TYPE,
  UmaProtection,
  UMA_PROTECTION_SCOPE
} from '../../../src/routes/token/UmaProtection';
import { HttpHandlerContext } from '../../../src/util/http/models/HttpHandler';

vi.useFakeTimers();

describe('UmaProtection', (): void => {
  const now = Date.now();
  const clientUri = 'http://example.org';
  const baseUrl = 'http://example.com';
  const userId = 'userId';
  const registrationId = 'registrationId';
  const clientId = 'clientId';
  const clientSecret = 'sec ret';
  const encoded = Buffer.from('clientId:sec%20ret', 'utf8').toString('base64');
  const alg = 'ES256';
  let keys: GenerateKeyPairResult;
  let publicKey: AlgJwk;
  let privateKey: AlgJwk;
  let context: HttpHandlerContext;

  let storage: Mocked<IndexedStorage<{
    [CLIENT_REGISTRATION_STORAGE_TYPE]: typeof CLIENT_REGISTRATION_STORAGE_DESCRIPTION,
    [PAT_STORAGE_TYPE]: typeof PAT_STORAGE_DESCRIPTION,
  }>>;
  let keyGen: Mocked<JwkGenerator>;
  let handler: UmaProtection;

  beforeAll(async(): Promise<void> => {
    keys = await generateKeyPair(alg);
    publicKey = { ...await exportJWK(keys.publicKey), alg };
    privateKey = { ...await exportJWK(keys.privateKey), alg };
  });

  beforeEach(async(): Promise<void> => {
    context = {
      request: {
        url: new URL('http://example.com/token'),
        parameters: {},
        method: 'POST',
        headers: {},
        body: {},
      },
    };

    storage = {
      defineType: vi.fn(),
      createIndex: vi.fn(),
      find: vi.fn().mockResolvedValue([{ id: registrationId, clientId, clientSecret, clientUri, userId }]),
      findIds: vi.fn().mockResolvedValue([]),
      set: vi.fn(),
      create: vi.fn(),
    } as any;

    keyGen = {
      alg,
      getPublicKey: vi.fn().mockResolvedValue(publicKey),
      getPrivateKey: vi.fn().mockResolvedValue(privateKey),
    };

    handler = new UmaProtection(storage as any, keyGen, baseUrl);
  });

  it('throws an error if the body is invalid.', async(): Promise<void> => {
    context.request.body = { ticket: 5 };
    await expect(handler.handle(context)).rejects
      .toThrow('Invalid token request body: value is neither of the union types');
  });

  it('throws an error if the scope is invalid.', async(): Promise<void> => {
    context.request.body = { grant_type: 'client_credentials' };
    await expect(handler.handle(context)).rejects.toThrow(`Expected scope '${UMA_PROTECTION_SCOPE}'`);
  });

  it('throws an error if the grant type is not supported.', async(): Promise<void> => {
    context.request.headers.authorization = `Basic ${encoded}`;
    context.request.body = { grant_type: 'not supported', scope: UMA_PROTECTION_SCOPE };
    await expect(handler.handle(context)).rejects.toThrow('Unsupported grant_type not supported');
  });

  describe('using client credentials', (): void => {
    beforeEach(async(): Promise<void> => {
      context.request.headers = {
        authorization: `Basic ${encoded}`,
      };
      context.request.body = {
        grant_type: 'client_credentials',
        scope: UMA_PROTECTION_SCOPE,
      };
    });

    it('errors if the authorization header is missing.', async(): Promise<void> => {
      delete context.request.headers.authorization;
      await expect(handler.handle(context)).rejects.toThrow(UnauthorizedHttpError);
    });

    it('errors for non-Basic authorization schemes.', async(): Promise<void> => {
      context.request.headers.authorization = `Bearer ${encoded}`;
      await expect(handler.handle(context)).rejects.toThrow(`Expected scheme 'Basic'`);
    });

    it('errors if the credentials are not known.', async(): Promise<void> => {
      storage.find.mockResolvedValueOnce([]);
      await expect(handler.handle(context)).rejects.toThrow(ForbiddenHttpError);
    });

    it('generates a token response.', async(): Promise<void> => {
      const response = await handler.handle(context);
      expect(response).toEqual({
        status: 201,
        body: {
          access_token: expect.any(String),
          refresh_token: expect.any(String),
          token_type: 'Bearer',
          expires_in: 1800,
        }
      });

      expect(storage.find).toHaveBeenCalledTimes(1);
      expect(storage.find).toHaveBeenLastCalledWith(CLIENT_REGISTRATION_STORAGE_TYPE, {
        clientId,
        clientSecret,
      });
      expect(storage.findIds).toHaveBeenCalledTimes(1);
      expect(storage.findIds).toHaveBeenLastCalledWith(PAT_STORAGE_TYPE, { registration: registrationId });
      expect(storage.create).toHaveBeenCalledTimes(1);
      expect(storage.create).toHaveBeenLastCalledWith(PAT_STORAGE_TYPE, {
        pat: response.body?.access_token,
        refreshToken: response.body?.refresh_token,
        expiration: now + 1800 * 1000,
        registration: registrationId,
      });

      const jwk = await importJWK(publicKey, publicKey.alg);
      const decodedToken = await jwtVerify(response.body!.access_token, jwk);
      expect(decodedToken.payload).toEqual({
        scope: UMA_PROTECTION_SCOPE,
        azp: clientId,
        client_id: clientId,
        iat: Math.floor(now / 1000),
        sub: userId,
        iss: baseUrl,
        aud: baseUrl,
        exp: Math.floor(now / 1000) + 1800,
        jti: expect.any(String),
      });
    });

    it('replaces the token for the given credentials if there is one.', async(): Promise<void> => {
      storage.findIds.mockResolvedValueOnce(['patId']);
      const response = await handler.handle(context);
      expect(response).toEqual({
        status: 201,
        body: {
          access_token: expect.any(String),
          refresh_token: expect.any(String),
          token_type: 'Bearer',
          expires_in: 1800,
        }
      });
      expect(storage.create).toHaveBeenCalledTimes(0);
      expect(storage.set).toHaveBeenCalledTimes(1);
      expect(storage.set).toHaveBeenLastCalledWith(PAT_STORAGE_TYPE, {
        id: 'patId',
        pat: response.body?.access_token,
        refreshToken: response.body?.refresh_token,
        expiration: now + 1800 * 1000,
        registration: registrationId,
      });
    });
  });

  describe('using a refresh token', (): void => {
    const refreshToken = 'refreshToken';
    const patId = 'patId';

    beforeEach(async(): Promise<void> => {
      context.request.headers = {
        authorization: `Basic ${encoded}`,
      };
      context.request.body = {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: UMA_PROTECTION_SCOPE,
      };

      storage.find.mockImplementation((type): any => {
        if (type === CLIENT_REGISTRATION_STORAGE_TYPE) {
          return [{ id: registrationId, clientId, clientSecret, clientUri, userId }];
        }
        return [{ id: patId, registration: registrationId, refreshToken }];
      });
    });

    it('errors if no refresh token is provided.', async(): Promise<void> => {
      context.request.body = {
        grant_type: 'refresh_token',
        scope: UMA_PROTECTION_SCOPE,
      };
      await expect(handler.handle(context)).rejects.toThrow('Missing refresh_token parameter');
    });

    it('errors if no matching refresh token could be found.', async(): Promise<void> => {
      storage.find.mockResolvedValueOnce([]);
      await expect(handler.handle(context)).rejects.toThrow(`Unknown refresh token ${refreshToken}`);
    });

    it('errors if the authorization header is missing.', async(): Promise<void> => {
      delete context.request.headers.authorization;
      await expect(handler.handle(context)).rejects.toThrow(UnauthorizedHttpError);
    });

    it('errors for non-Basic authorization schemes.', async(): Promise<void> => {
      context.request.headers.authorization = `Bearer ${encoded}`;
      await expect(handler.handle(context)).rejects.toThrow(`Expected scheme 'Basic'`);
    });

    it('errors if the credentials are not known.', async(): Promise<void> => {
      storage.find.mockImplementation((type): any => {
        if (type === CLIENT_REGISTRATION_STORAGE_TYPE) {
          return [];
        }
        return [{ id: patId, registration: registrationId, refreshToken }];
      });
      await expect(handler.handle(context)).rejects.toThrow(ForbiddenHttpError);
    });

    it('errors if the refresh token is not associated with these credentials.', async(): Promise<void> => {
      storage.find.mockImplementation((type): any => {
        if (type === CLIENT_REGISTRATION_STORAGE_TYPE) {
          return [{ id: 'wrongId', clientId, clientSecret, clientUri, userId }];
        }
        return [{ id: patId, registration: registrationId, refreshToken }];
      });
      await expect(handler.handle(context)).rejects.toThrow(`Wrong credentials for refresh token ${refreshToken}`);
    });

    it('generates a token response.', async(): Promise<void> => {
      const response = await handler.handle(context);
      expect(response).toEqual({
        status: 201,
        body: {
          access_token: expect.any(String),
          refresh_token: expect.any(String),
          token_type: 'Bearer',
          expires_in: 1800,
        }
      });

      expect(storage.find).toHaveBeenCalledTimes(2);
      expect(storage.find).nthCalledWith(1, PAT_STORAGE_TYPE, { refreshToken });
      expect(storage.find).nthCalledWith(2, CLIENT_REGISTRATION_STORAGE_TYPE, {
        clientId,
        clientSecret,
      });
      expect(storage.create).toHaveBeenCalledTimes(0);
      expect(storage.set).toHaveBeenCalledTimes(1);
      expect(storage.set).toHaveBeenLastCalledWith(PAT_STORAGE_TYPE, {
        id: patId,
        pat: response.body?.access_token,
        refreshToken: response.body?.refresh_token,
        expiration: now + 1800 * 1000,
        registration: registrationId,
      });
    });
  });
});
