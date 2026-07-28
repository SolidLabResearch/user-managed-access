import * as jose from 'jose';
import { getJwks, jwksRecord } from '../../../src/util/JwtUtil';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(),
  decodeJwt: vi.fn(),
  jwtVerify: vi.fn(),
}));

describe('JwtUtil', (): void => {
  const issuer = 'http://example.org/issuer';
  const remoteKeySet = 'remoteKeySet';
  const fetchMock = vi.spyOn(global, 'fetch');
  const createRemoteJWKSet = vi.spyOn(jose, 'createRemoteJWKSet');

  beforeEach(async(): Promise<void> => {
    vi.clearAllMocks();
    delete jwksRecord[issuer];

    fetchMock.mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({
        issuer,
        jwks_uri: `${issuer}/jwks_uri`
      }),
    } as any);

    createRemoteJWKSet.mockReturnValue(remoteKeySet as any);
  });

  describe('#getJwks', (): void => {
    it('returns a JWKSet for the given issuer.', async(): Promise<void> => {
        await expect(getJwks(issuer)).resolves.toBe(remoteKeySet);
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith('http://example.org/issuer/.well-known/openid-configuration');
        expect(createRemoteJWKSet).toHaveBeenCalledExactlyOnceWith(new URL('http://example.org/issuer/jwks_uri'));
    });

    it('errors if the OpenID config cannot be fetched.', async(): Promise<void> => {
      fetchMock.mockResolvedValue({ status: 500 } as any);

      await expect(getJwks(issuer)).rejects.toThrow('Unable to access http://example.org/issuer/.well-known/openid-configuration');
    });

    it('caches results.', async(): Promise<void> => {
      await expect(getJwks(issuer)).resolves.toBe(remoteKeySet);
      fetchMock.mockResolvedValue({ status: 500 } as any);
      await expect(getJwks(issuer)).resolves.toBe(remoteKeySet);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('errors if there is an issuer mismatch.', async(): Promise<void> => {
        fetchMock.mockResolvedValue({
          status: 200,
          json: vi.fn().mockResolvedValue({
            issuer: 'http://example.org/other-issuer',
            jwks_uri: `${issuer}/jwks_uri`
          }),
        } as any);

        await expect(getJwks(issuer)).rejects.toThrow(`Issuer mismatch: expected http://example.org/issuer, got http://example.org/other-issuer`);
    });

    it('errors if there is no jwks_uri in the OpenID configuration.', async(): Promise<void> => {
      fetchMock.mockResolvedValue({
        status: 200,
        json: vi.fn().mockResolvedValue({
          issuer,
        }),
      } as any);

      await expect(getJwks(issuer)).rejects.toThrow(`Missing jwks_uri from http://example.org/issuer/.well-known/openid-configuration`);
    });
  });
});
