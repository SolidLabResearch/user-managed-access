import { BaseHandler } from '../../../src/routes/BaseHandler';
import { WEBID } from '../../../src/credentials/Claims';

describe('BaseHandler', (): void => {
  const owner = 'http://rs.local:3000/alice/profile/card#me';

  it('returns text/plain error messages for failed POST requests.', async(): Promise<void> => {
    const message = 'No valid ODRL policy found.';
    const handler = createHandler({
      addEntity: vi.fn().mockResolvedValue({ status: 400, message }),
    });

    await expect(handler.handle({
      request: {
        method: 'POST',
        url: new URL('http://uma.local:4000/uma/policies'),
        headers: {},
        body: Buffer.from('policy'),
      },
    })).resolves.toEqual({
      status: 400,
      body: message,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  });

  function createHandler(controllerOverrides: Record<string, unknown>): BaseHandler {
    return new BaseHandler(
      controllerOverrides as any,
      { handleSafe: vi.fn().mockResolvedValue('credential') } as any,
      { verify: vi.fn().mockResolvedValue({ [WEBID]: owner }) } as any,
      'test request',
      'application/sparql-update',
    );
  }
});
