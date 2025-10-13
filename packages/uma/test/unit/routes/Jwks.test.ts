import { JwkGenerator } from '@solid/community-server';
import { Mocked } from 'vitest';
import { JwksRequestHandler } from '../../../src/routes/Jwks';
import { HttpHandlerContext } from '../../../src/util/http/models/HttpHandler';

describe('Jwks', (): void => {
  const context: HttpHandlerContext = { request: { url: 'url' }} as any;
  const key = { key: 'value' };
  let generator: Mocked<JwkGenerator>
  let handler: JwksRequestHandler;

  beforeEach(async(): Promise<void> => {
    generator = {
      getPublicKey: vi.fn().mockResolvedValue(key),
    } satisfies Partial<JwkGenerator> as any;

    handler = new JwksRequestHandler(generator);
  });

  it('returns the public key.', async(): Promise<void> => {
    await expect(handler.handle(context)).resolves.toEqual({
      status: 200,
      body: { keys: [ key ]},
    });
  });
});
