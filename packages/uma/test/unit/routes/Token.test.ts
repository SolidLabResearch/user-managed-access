import {
  AlgJwk,
  ForbiddenHttpError,
  IndexedStorage,
  JwkGenerator,
  UnauthorizedHttpError
} from '@solid/community-server';
import { decodeJwt, exportJWK, generateKeyPair, GenerateKeyPairResult, importJWK, jwtVerify, KeyLike } from 'jose';
import { beforeAll, Mocked } from 'vitest';
import { Negotiator } from '../../../src/dialog/Negotiator';
import { NeedInfoError } from '../../../src/errors/NeedInfoError';
import {
  CLIENT_REGISTRATION_STORAGE_DESCRIPTION,
  CLIENT_REGISTRATION_STORAGE_TYPE
} from '../../../src/routes/ClientRegistration';
import { PAT_STORAGE_DESCRIPTION, PAT_STORAGE_TYPE, TokenRequestHandler } from '../../../src/routes/Token';
import { HttpHandlerRequest } from '../../../src/util/http/models/HttpHandler';

vi.useFakeTimers();

describe('Token', (): void => {
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
  let request: HttpHandlerRequest;

  let negotiator: Mocked<Negotiator>;
  let storage: Mocked<IndexedStorage<{
    [CLIENT_REGISTRATION_STORAGE_TYPE]: typeof CLIENT_REGISTRATION_STORAGE_DESCRIPTION,
    [PAT_STORAGE_TYPE]: typeof PAT_STORAGE_DESCRIPTION,
  }>>;
  let keyGen: Mocked<JwkGenerator>;
  let handler: TokenRequestHandler;

  beforeAll(async(): Promise<void> => {
    keys = await generateKeyPair(alg);
    publicKey = { ...await exportJWK(keys.publicKey), alg };
    privateKey = { ...await exportJWK(keys.privateKey), alg };
  });

  beforeEach(async(): Promise<void> => {
    request = {
      url: new URL('http://example.com/token'),
      parameters: {},
      method: 'POST',
      headers: {},
      body: {},
    };

    negotiator = {
      negotiate: vi.fn().mockResolvedValue('response'),
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
      alg: alg,
      getPublicKey: vi.fn().mockResolvedValue(publicKey),
      getPrivateKey: vi.fn().mockResolvedValue(privateKey),
    };

    handler = new TokenRequestHandler(negotiator, storage as any, keyGen, baseUrl);
  });

  it('throws an error if the body is invalid.', async(): Promise<void> => {
    request.body = { ticket: 5 };
    await expect(handler.handle({ request })).rejects
      .toThrow('Invalid token request body: value is neither of the union types');
  });

  it('throws an error if the grant type is not supported.', async(): Promise<void> => {
    request.body = { grant_type: 'not supported' };
    await expect(handler.handle({ request })).rejects
      .toThrow('Unsupported grant_type not supported')
  });

  describe('generating an UMA token', (): void => {
    beforeEach(async(): Promise<void> => {
      request.body =  {
        ticket: 'ticket',
        grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
      };
    });

    it('returns the negotiated response.', async(): Promise<void> => {
      await expect(handler.handle({ request })).resolves.toEqual({ status: 200, body: 'response' });
      expect(negotiator.negotiate).toHaveBeenCalledTimes(1);
      expect(negotiator.negotiate).toHaveBeenLastCalledWith(request.body);
    });

    it('returns a 403 with the ticket if negotiation needs more info.', async(): Promise<void> => {
      const needInfo = new NeedInfoError('msg', 'ticket', { required_claims: { claim_token_format: [[ 'format' ]] } });
      negotiator.negotiate.mockRejectedValueOnce(needInfo);
      await expect(handler.handle({ request })).resolves.toEqual({ status: 403, body: {
          ticket: 'ticket',
          required_claims: { claim_token_format: [[ 'format' ]] },
        }});
    });

    it('throws an error if something else goes wrong.', async(): Promise<void> => {
      negotiator.negotiate.mockRejectedValueOnce(new Error('bad data'));
      await expect(handler.handle({ request })).rejects.toThrow('bad data');
    });
  });

  describe('using client credentials', (): void => {
    beforeEach(async(): Promise<void> => {
      request.headers = {
        authorization: `Basic ${encoded}`,
      };
      request.body =  {
        grant_type: 'client_credentials',
        scope: 'uma_protection',
      };
    });

    it('errors if the authorization header is missing.', async(): Promise<void> => {
      delete request.headers.authorization;
      await expect(handler.handle({ request })).rejects.toThrow(UnauthorizedHttpError);
    });

    it('errors if the scope is wrong.', async(): Promise<void> => {
      request.body = { grant_type: 'client_credentials' };
      await expect(handler.handle({ request })).rejects.toThrow(`Expected scope 'uma_protection'`);
    });

    it('errors for non-Basic authorization schemes.', async(): Promise<void> => {
      request.headers.authorization = `Bearer ${encoded}`;
      await expect(handler.handle({ request })).rejects.toThrow(`Expected scheme 'Basic'`);
    });

    it('errors if the credentials are not known.', async(): Promise<void> => {
      storage.find.mockResolvedValueOnce([]);
      await expect(handler.handle({ request })).rejects.toThrow(ForbiddenHttpError);
    });

    it('generates a token response.', async(): Promise<void> => {
      const response = await handler.handle({ request });
      expect(response).toEqual({
        status: 201,
        body: {
          access_token: expect.any(String),
          refresh_token: expect.any(String),
          token_type: 'Bearer',
          expires_in: 1800,
          scope: 'uma_protection',
        }
      });

      expect(storage.find).toHaveBeenCalledTimes(1);
      expect(storage.find).toHaveBeenLastCalledWith(CLIENT_REGISTRATION_STORAGE_TYPE, {
        clientId: clientId,
        clientSecret: clientSecret,
      });
      expect(storage.findIds).toHaveBeenCalledTimes(1);
      expect(storage.findIds).toHaveBeenLastCalledWith(PAT_STORAGE_TYPE, { registration: registrationId });
      expect(storage.create).toHaveBeenCalledTimes(1);
      expect(storage.create).toHaveBeenLastCalledWith(PAT_STORAGE_TYPE, {
        pat: response.body.access_token,
        refreshToken: response.body.refresh_token,
        expiration: now + 1800 * 1000,
        registration: registrationId,
      });

      const jwk = await importJWK(publicKey, publicKey.alg);
      const decodedToken = await jwtVerify(response.body.access_token, jwk);
      expect(decodedToken.payload).toEqual({
        scope: 'uma_protection',
        azp: clientId,
        client_id: clientId,
        iat: Math.floor(now/1000),
        sub: userId,
        iss: baseUrl,
        aud: baseUrl,
        exp: Math.floor(now/1000) + 1800,
        jti: expect.any(String),
      })
    });

    it('replaces the token for the given credentials if there is one.', async(): Promise<void> => {
      storage.findIds.mockResolvedValueOnce(['patId']);
      const response = await handler.handle({ request });
      expect(response).toEqual({
        status: 201,
        body: {
          access_token: expect.any(String),
          refresh_token: expect.any(String),
          token_type: 'Bearer',
          expires_in: 1800,
          scope: 'uma_protection',
        }
      });
      expect(storage.create).toHaveBeenCalledTimes(0);
      expect(storage.set).toHaveBeenCalledTimes(1);
      expect(storage.set).toHaveBeenLastCalledWith(PAT_STORAGE_TYPE, {
        id: 'patId',
        pat: response.body.access_token,
        refreshToken: response.body.refresh_token,
        expiration: now + 1800 * 1000,
        registration: registrationId,
      });
    });
  });

  describe('using a refresh token', (): void => {
    const refreshToken = 'refreshToken';
    const patId = 'patId';

    beforeEach(async(): Promise<void> => {
      request.headers = {
        authorization: `Basic ${encoded}`,
      };
      request.body =  {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'uma_protection',
      };

      storage.find.mockImplementation((type): any => {
        if (type === CLIENT_REGISTRATION_STORAGE_TYPE) {
          return [{ id: registrationId, clientId, clientSecret, clientUri, userId }];
        }
        return [{ id: patId, registration: registrationId, refreshToken: refreshToken }];
      });
    });

    it('errors if no refresh token is provided.', async(): Promise<void> => {
      request.body = {
        grant_type: 'refresh_token',
        scope: 'uma_protection',
      };
      await expect(handler.handle({ request })).rejects.toThrow('Missing refresh_token parameter');
    });

    it('errors if no matching refresh token could be found.', async(): Promise<void> => {
      storage.find.mockResolvedValueOnce([]);
      await expect(handler.handle({ request })).rejects.toThrow(`Unknown refresh token ${refreshToken}`);
    });

    it('errors if the authorization header is missing.', async(): Promise<void> => {
      delete request.headers.authorization;
      await expect(handler.handle({ request })).rejects.toThrow(UnauthorizedHttpError);
    });

    it('errors if the scope is wrong.', async(): Promise<void> => {
      request.body = { grant_type: 'client_credentials' };
      await expect(handler.handle({ request })).rejects.toThrow(`Expected scope 'uma_protection'`);
    });

    it('errors for non-Basic authorization schemes.', async(): Promise<void> => {
      request.headers.authorization = `Bearer ${encoded}`;
      await expect(handler.handle({ request })).rejects.toThrow(`Expected scheme 'Basic'`);
    });

    it('errors if the credentials are not known.', async(): Promise<void> => {
      storage.find.mockImplementation((type): any => {
        if (type === CLIENT_REGISTRATION_STORAGE_TYPE) {
          return [];
        }
        return [{ id: patId, registration: registrationId, refreshToken: refreshToken }];
      });
      await expect(handler.handle({ request })).rejects.toThrow(ForbiddenHttpError);
    });

    it('errors if the refresh token is not associated with these credentials.', async(): Promise<void> => {
      storage.find.mockImplementation((type): any => {
        if (type === CLIENT_REGISTRATION_STORAGE_TYPE) {
          return [{ id: 'wrongId', clientId, clientSecret, clientUri, userId }];
        }
        return [{ id: patId, registration: registrationId, refreshToken: refreshToken }];
      });
      await expect(handler.handle({ request })).rejects.toThrow(`Wrong credentials for refresh token ${refreshToken}`);
    });

    it('generates a token response.', async(): Promise<void> => {
      const response = await handler.handle({ request });
      expect(response).toEqual({
        status: 201,
        body: {
          access_token: expect.any(String),
          refresh_token: expect.any(String),
          token_type: 'Bearer',
          expires_in: 1800,
          scope: 'uma_protection',
        }
      });

      expect(storage.find).toHaveBeenCalledTimes(2);
      expect(storage.find).nthCalledWith(1, PAT_STORAGE_TYPE, { refreshToken });
      expect(storage.find).nthCalledWith(2, CLIENT_REGISTRATION_STORAGE_TYPE, {
        clientId: clientId,
        clientSecret: clientSecret,
      });
      expect(storage.create).toHaveBeenCalledTimes(0);
      expect(storage.set).toHaveBeenCalledTimes(1);
      expect(storage.set).toHaveBeenLastCalledWith(PAT_STORAGE_TYPE, {
        id: 'patId',
        pat: response.body.access_token,
        refreshToken: response.body.refresh_token,
        expiration: now + 1800 * 1000,
        registration: registrationId,
      });
    });
  });
});
