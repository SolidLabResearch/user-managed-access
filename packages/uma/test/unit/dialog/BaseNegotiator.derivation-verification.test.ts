import { KeyValueStorage } from '@solid/community-server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Mocked } from 'vitest';
import { BaseNegotiator } from '../../../src/dialog/BaseNegotiator';
import { Verifier } from '../../../src/credentials/verify/Verifier';
import { TicketingStrategy } from '../../../src/ticketing/strategy/TicketingStrategy';
import { Ticket } from '../../../src/ticketing/Ticket';
import { TokenFactory } from '../../../src/tokens/TokenFactory';

vi.mock('jose', async(): Promise<Record<string, unknown>> => {
  const actual = await vi.importActual<Record<string, unknown>>('jose');
  return {
    ...actual,
    createRemoteJWKSet: vi.fn().mockReturnValue('remote-jwks'),
    decodeJwt: vi.fn().mockReturnValue({ iss: 'http://uma.local:4000/uma' }),
    jwtVerify: vi.fn().mockResolvedValue({ payload: { iss: 'http://uma.local:4000/uma' }}),
  };
});

class TestNegotiator extends BaseNegotiator {
  public async verifyAccessToken(token: string): Promise<unknown> {
    return this.verifyJwtAccessToken(token);
  }
}

describe('BaseNegotiator derivation access token verification', (): void => {
  let negotiator: TestNegotiator;

  beforeEach(async(): Promise<void> => {
    const verifier: Mocked<Verifier> = {
      verify: vi.fn(),
    };
    const ticketStore: Mocked<KeyValueStorage<string, Ticket>> = {
      has: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      entries: vi.fn(),
    };
    const ticketingStrategy: Mocked<TicketingStrategy> = {
      initializeTicket: vi.fn(),
      validateClaims: vi.fn(),
      resolveTicket: vi.fn(),
    };
    const tokenFactory: Mocked<TokenFactory> = {
      serialize: vi.fn(),
      deserialize: vi.fn(),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ jwks_uri: 'http://uma.local:4000/uma/keys' }),
    }));

    negotiator = new TestNegotiator(verifier, ticketStore, ticketingStrategy, tokenFactory);
  });

  afterEach(async(): Promise<void> => {
    vi.unstubAllGlobals();
  });

  it('verifies derivation access tokens with the issuer UMA jwks_uri.', async(): Promise<void> => {
    await expect(negotiator.verifyAccessToken('token')).resolves.toEqual({ iss: 'http://uma.local:4000/uma' });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenLastCalledWith('http://uma.local:4000/uma/.well-known/uma2-configuration');
    expect(createRemoteJWKSet).toHaveBeenCalledTimes(1);
    expect(createRemoteJWKSet).toHaveBeenLastCalledWith(new URL('http://uma.local:4000/uma/keys'));
    expect(jwtVerify).toHaveBeenCalledTimes(1);
    expect(jwtVerify).toHaveBeenLastCalledWith('token', 'remote-jwks');
  });
});
