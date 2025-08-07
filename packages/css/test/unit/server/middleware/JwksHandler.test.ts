import { AlgJwk, HttpRequest, HttpResponse, JwkGenerator } from '@solid/community-server';
import { Mocked } from 'vitest';
import { JwksHandler } from '../../../../src/server/middleware/JwksHandler';

describe('JwksHandler', (): void => {
  const key: AlgJwk = { alg: 'ES256' };
  let request: HttpRequest;
  let response: Mocked<HttpResponse>;
  let generator: Mocked<JwkGenerator>;
  let handler: JwksHandler;

  beforeEach(async(): Promise<void> => {
    request = {} as any;

    response = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as any;

    generator = {
      alg: 'ES256',
      getPublicKey: vi.fn().mockResolvedValue(key),
      getPrivateKey: vi.fn(),
    };

    handler = new JwksHandler(generator);
  });

  it('returns nothing for HEAD requests.', async(): Promise<void> => {
    request.method = 'HEAD';
    await expect(handler.handle({ request, response })).resolves.toBeUndefined();
    expect(response.writeHead).toHaveBeenCalledTimes(1);
    expect(response.writeHead).toHaveBeenLastCalledWith(200, { 'content-type': 'application/json' });
    expect(response.end).toHaveBeenCalledTimes(1);
    expect(response.end).toHaveBeenLastCalledWith();
  });

  it('returns the key for other methods.', async(): Promise<void> => {
    await expect(handler.handle({ request, response })).resolves.toBeUndefined();
    expect(response.writeHead).toHaveBeenCalledTimes(1);
    expect(response.writeHead).toHaveBeenLastCalledWith(200, { 'content-type': 'application/json' });
    expect(response.end).toHaveBeenCalledTimes(1);
    expect(response.end).toHaveBeenLastCalledWith(JSON.stringify({ keys: [
        { ...key, kid: 'TODO' },
      ]}));
  });
});
