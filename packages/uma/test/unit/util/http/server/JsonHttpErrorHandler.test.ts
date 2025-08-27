import { BadRequestHttpError } from '@solid/community-server';
import { Mocked } from 'vitest';
import { NeedInfoError } from '../../../../../src/errors/NeedInfoError';
import { HttpHandler, HttpHandlerContext } from '../../../../../src/util/http/models/HttpHandler';
import { JsonHttpErrorHandler } from '../../../../../src/util/http/server/JsonHttpErrorHandler';

describe('JsonHttpErrorHandler', (): void => {
  const context: HttpHandlerContext<Buffer> = {
    request: {
      url: new URL('https://example.com/foo'),
      method: 'GET',
      headers: {},
    }
  }
  let source: Mocked<HttpHandler<HttpHandlerContext<Buffer>, Buffer>>;
  let handler: JsonHttpErrorHandler;

  beforeEach(async(): Promise<void> => {
    source = {
      canHandle: vi.fn(),
      handle: vi.fn(),
      handleSafe: vi.fn().mockResolvedValue('handleSafe')
    }

    handler = new JsonHttpErrorHandler(source);
  });

  it('calls the source handleSafe function.', async(): Promise<void> => {
    await expect(handler.handle(context)).resolves.toBe('handleSafe');
    expect(source.handleSafe).toHaveBeenCalledTimes(1);
    expect(source.handleSafe).toHaveBeenLastCalledWith(context);
  });

  it('returns an error response if there is an error.', async(): Promise<void> => {
    source.handleSafe.mockRejectedValueOnce(new NeedInfoError('bad data', 'ticket', { redirect_user: 'user' }));
    const response = await handler.handle(context);
    expect(response.status).toBe(403);
    expect(response.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(response.body!.toString())).toEqual({
      status: 403,
      description: 'Forbidden',
      error: 'request_denied',
      message: 'bad data',
      redirect_user: 'user',
    });
  });

  it('defaults to 500 errors if no information is provided.', async(): Promise<void> => {
    source.handleSafe.mockRejectedValueOnce(new Error('bad data'));
    const response = await handler.handle(context);
    expect(response.status).toBe(500);
    expect(response.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(response.body!.toString())).toEqual({
      status: 500,
      description: 'Internal Server Error',
      message: 'bad data',
    });
  });
});
