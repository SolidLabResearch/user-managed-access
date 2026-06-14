import { Mocked } from 'vitest';
import { IntrospectionHandler } from '../../../src/routes/Introspection';
import { TokenFactory } from '../../../src/tokens/TokenFactory';
import { HttpHandlerContext } from '../../../src/util/http/models/HttpHandler';
import { RequestValidator } from '../../../src/util/http/validate/RequestValidator';
import { RegistrationStore } from '../../../src/util/RegistrationStore';

describe('Introspection', (): void => {
  const request: HttpHandlerContext = { request: { body: { token: 'token' } } } as any;
  const token = { permissions: [{ resource_id: 'id', resource_scopes: [ 'scope' ] }], issued_at: 1000 };
  let factory: Mocked<TokenFactory>;
  let validator: Mocked<RequestValidator>;
  let registrationStore: Mocked<RegistrationStore>;
  let handler: IntrospectionHandler;

  beforeEach(async(): Promise<void> => {
    validator = {
      handleSafe: vi.fn().mockResolvedValue({ owner: 'owner' }),
    } satisfies Partial<RequestValidator> as any;

    factory = {
      deserialize: vi.fn().mockResolvedValue(token),
    } satisfies Partial<TokenFactory> as any;

    registrationStore = {
      get: vi.fn().mockResolvedValue({
        owner: 'owner',
        description: { resource_scopes: [ 'scope' ] },
        registeredAt: '1970-01-01T00:00:00.500Z',
        updatedAt: '1970-01-01T00:00:00.500Z',
      }),
    } satisfies Partial<RegistrationStore> as any;

    handler = new IntrospectionHandler(factory, validator, registrationStore);
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
    expect(registrationStore.get).toHaveBeenCalledTimes(1);
    expect(registrationStore.get).toHaveBeenLastCalledWith('id');
  });

  it('returns an inactive response if the token could not be deserialized.', async(): Promise<void> => {
    factory.deserialize.mockRejectedValueOnce(new Error('bad data'));
    await expect(handler.handle(request)).resolves.toEqual({
      status: 200,
      body: { active: false },
    });
    expect(validator.handleSafe).toHaveBeenCalledTimes(1);
    expect(factory.deserialize).toHaveBeenCalledTimes(1);
    expect(factory.deserialize).toHaveBeenLastCalledWith('token');
  });

  it('returns an inactive response if a target resource has been updated since the token was issued.', async():
    Promise<void> => {
    registrationStore.get.mockResolvedValueOnce({
      owner: 'owner',
      description: { resource_scopes: [ 'scope' ] },
      registeredAt: '1970-01-01T00:00:00.500Z',
      updatedAt: '1970-01-01T00:00:01.500Z',
    });

    await expect(handler.handle(request)).resolves.toEqual({
      status: 200,
      body: { active: false },
    });
    expect(factory.deserialize).toHaveBeenCalledTimes(1);
    expect(registrationStore.get).toHaveBeenCalledTimes(1);
    expect(registrationStore.get).toHaveBeenLastCalledWith('id');
  });

  it('falls back to the JWT iat if no millisecond issue timestamp is present.', async(): Promise<void> => {
    factory.deserialize.mockResolvedValueOnce({
      permissions: [{ resource_id: 'id', resource_scopes: [ 'scope' ] }],
      iat: 1,
    });

    await expect(handler.handle(request)).resolves.toEqual({
      status: 200,
      body: {
        permissions: [{ resource_id: 'id', resource_scopes: [ 'scope' ] }],
        iat: 1,
        active: true,
      },
    });
    expect(registrationStore.get).toHaveBeenCalledTimes(1);
    expect(registrationStore.get).toHaveBeenLastCalledWith('id');
  });
});
