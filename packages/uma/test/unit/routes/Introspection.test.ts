import { KeyValueStorage, UnauthorizedHttpError } from '@solid/community-server';
import { Mocked } from 'vitest';
import { IntrospectionHandler } from '../../../src/routes/Introspection';
import { AccessToken } from '../../../src/tokens/AccessToken';
import { TokenFactory } from '../../../src/tokens/TokenFactory';
import { HttpHandlerContext } from '../../../src/util/http/models/HttpHandler';
import * as signatures from '../../../src/util/HttpMessageSignatures';

describe('Introspection', (): void => {
  const request: HttpHandlerContext = { request: { body: { token: 'token' } } } as any;
  const token = { key: 'value' };
  let verifyRequest = vi.spyOn(signatures, 'verifyRequest');
  let factory: Mocked<TokenFactory>;
  let handler: IntrospectionHandler;

  beforeEach(async(): Promise<void> => {
    vi.clearAllMocks();
    verifyRequest.mockResolvedValue(true);

    factory = {
      deserialize: vi.fn().mockResolvedValue(token),
    } satisfies Partial<TokenFactory> as any;

    handler = new IntrospectionHandler(factory);
  });

  it('errors if the request is not authorized.', async(): Promise<void> => {
    verifyRequest.mockResolvedValueOnce(false);
    await expect(handler.handle(request)).rejects.toThrow(UnauthorizedHttpError);
    expect(verifyRequest).toHaveBeenCalledTimes(1);
    expect(verifyRequest).toHaveBeenLastCalledWith(request.request);
  });

  it('throws an error if there is no body.', async(): Promise<void> => {
    const emptyRequest = { request: {} } as any;
    await expect(handler.handle(emptyRequest)).rejects.toThrow('Missing request body.');
    expect(verifyRequest).toHaveBeenCalledTimes(1);
    expect(verifyRequest).toHaveBeenLastCalledWith({});
  });

  it('returns the token.', async(): Promise<void> => {
    await expect(handler.handle(request)).resolves.toEqual({
      status: 200,
      body: { ...token, active: true },
    });
    expect(verifyRequest).toHaveBeenCalledTimes(1);
    expect(factory.deserialize).toHaveBeenCalledTimes(1);
    expect(factory.deserialize).toHaveBeenLastCalledWith('token');
  });

  it('errors if the token could not be deserialized.', async(): Promise<void> => {
    factory.deserialize.mockRejectedValueOnce(new Error('bad data'));
    await expect(handler.handle(request)).rejects.toThrow('Invalid request body.');
    expect(verifyRequest).toHaveBeenCalledTimes(1);
    expect(factory.deserialize).toHaveBeenCalledTimes(1);
    expect(factory.deserialize).toHaveBeenLastCalledWith('token');
  });
});
