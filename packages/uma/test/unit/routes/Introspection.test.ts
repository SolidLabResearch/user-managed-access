import { Mocked } from 'vitest';
import { IntrospectionHandler } from '../../../src/routes/Introspection';
import { TokenFactory } from '../../../src/tokens/TokenFactory';
import { HttpHandlerContext } from '../../../src/util/http/models/HttpHandler';
import { RequestValidator } from '../../../src/util/http/validate/RequestValidator';

describe('Introspection', (): void => {
  const request: HttpHandlerContext = { request: { body: { token: 'token' } } } as any;
  const token = { key: 'value' };
  let factory: Mocked<TokenFactory>;
  let validator: Mocked<RequestValidator>;
  let handler: IntrospectionHandler;

  beforeEach(async(): Promise<void> => {
    validator = {
      handleSafe: vi.fn().mockResolvedValue({ owner: 'owner' }),
    } satisfies Partial<RequestValidator> as any;

    factory = {
      deserialize: vi.fn().mockResolvedValue(token),
    } satisfies Partial<TokenFactory> as any;

    handler = new IntrospectionHandler(factory, validator);
  });

  it('throws an error if there is no body.', async(): Promise<void> => {
    const emptyRequest = { request: {} } as any;
    await expect(handler.handle(emptyRequest)).rejects.toThrow('Missing request body.');
    expect(validator.handleSafe).toHaveBeenCalledTimes(1);
    expect(validator.handleSafe).toHaveBeenLastCalledWith({ request: {}});
  });

  it('returns the token.', async(): Promise<void> => {
    await expect(handler.handle(request)).resolves.toEqual({
      status: 200,
      body: { ...token, active: true },
    });
    expect(validator.handleSafe).toHaveBeenCalledTimes(1);
    expect(factory.deserialize).toHaveBeenCalledTimes(1);
    expect(factory.deserialize).toHaveBeenLastCalledWith('token');
  });

  it('errors if the token could not be deserialized.', async(): Promise<void> => {
    factory.deserialize.mockRejectedValueOnce(new Error('bad data'));
    await expect(handler.handle(request)).rejects.toThrow('Invalid request body.');
    expect(validator.handleSafe).toHaveBeenCalledTimes(1);
    expect(factory.deserialize).toHaveBeenCalledTimes(1);
    expect(factory.deserialize).toHaveBeenLastCalledWith('token');
  });
});
