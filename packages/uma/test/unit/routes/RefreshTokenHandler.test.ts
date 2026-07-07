import { BadRequestHttpError, ForbiddenHttpError, KeyValueStorage } from '@solid/community-server';
import { Mocked } from 'vitest';
import { REFRESH_TOKEN } from '../../../src/credentials/Formats';
import { RefreshInformation } from '../../../src/credentials/verify/RefreshTokenVerifier';
import { Negotiator } from '../../../src/dialog/Negotiator';
import { RefreshTokenHandler } from '../../../src/routes/token/RefreshTokenHandler';
import { HttpHandlerContext } from '../../../src/util/http/models/HttpHandler';

vi.useFakeTimers();

describe('RefreshTokenHandler', (): void => {
  const refreshToken = 'refresh-token';
  const expiration = Date.now() + 5_000;
  const claims = { webid: 'https://alice.example/#me' };
  const permissions = [
    { resource_id: 'https://pod.example/private/', resource_scopes: [ 'read' ] },
  ];

  let context: HttpHandlerContext;
  let refreshStore: Mocked<KeyValueStorage<string, RefreshInformation>>;
  let negotiator: Mocked<Negotiator>;
  let handler: RefreshTokenHandler;

  beforeEach(async(): Promise<void> => {
    context = {
      request: {
        url: new URL('http://example.com/token'),
        method: 'POST',
        headers: {},
        body: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        },
      },
    };

    refreshStore = {
      get: vi.fn().mockResolvedValue({ claims, permissions, expiration }),
      set: vi.fn(),
      delete: vi.fn(),
    } satisfies Partial<KeyValueStorage<string, RefreshInformation>> as any;

    negotiator = {
      negotiate: vi.fn().mockResolvedValue({
        access_token: 'new-access-token',
        token_type: 'Bearer',
        refresh_token: 'rotated-refresh-token',
      }),
    };

    handler = new RefreshTokenHandler(refreshStore, negotiator);
  });

  it('errors if request body is invalid.', async(): Promise<void> => {
    context.request.body = { refresh_token: 1 };
    await expect(handler.handle(context)).rejects
      .toThrow('Invalid token request body: value is neither of the union types');
  });

  it('errors for unsupported grant type.', async(): Promise<void> => {
    context.request.body = { grant_type: 'client_credentials' };
    await expect(handler.handle(context)).rejects
      .toThrow('Unsupported grant_type client_credentials');
  });

  it('errors if refresh token is missing.', async(): Promise<void> => {
    context.request.body = { grant_type: 'refresh_token' };
    await expect(handler.handle(context)).rejects.toThrow('Missing refresh_token parameter');
  });

  it('errors if refresh token is unknown.', async(): Promise<void> => {
    refreshStore.get.mockResolvedValueOnce(undefined);
    await expect(handler.handle(context)).rejects
      .toThrow(`Refresh token ${refreshToken} not recognized.`);
  });

  it('errors if refresh token is expired and deletes it.', async(): Promise<void> => {
    refreshStore.get.mockResolvedValueOnce({ claims, permissions, expiration: Date.now() - 100 });
    await expect(handler.handle(context)).rejects.toThrow(ForbiddenHttpError);
    expect(refreshStore.delete).toHaveBeenCalledTimes(1);
    expect(refreshStore.delete).toHaveBeenLastCalledWith(refreshToken);
  });

  it('re-negotiates and deletes old refresh token after rotation.', async(): Promise<void> => {
    const response = await handler.handle(context);

    expect(negotiator.negotiate).toHaveBeenCalledTimes(1);
    expect(negotiator.negotiate).toHaveBeenLastCalledWith({
      permissions,
      claim_token: refreshToken,
      claim_token_format: REFRESH_TOKEN,
    });

    expect(refreshStore.set).toHaveBeenCalledTimes(0);
    expect(refreshStore.delete).toHaveBeenCalledExactlyOnceWith(refreshToken);

    expect(response).toEqual({
      status: 200,
      body: {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        refresh_token: 'rotated-refresh-token',
      },
    });
  });

  it('does not rotate token when re-negotiation fails.', async(): Promise<void> => {
    negotiator.negotiate.mockRejectedValueOnce(new BadRequestHttpError('authorization no longer valid'));
    await expect(handler.handle(context)).rejects.toThrow('authorization no longer valid');
    expect(refreshStore.set).toHaveBeenCalledTimes(0);
    expect(refreshStore.delete).toHaveBeenCalledTimes(0);
  });
});
