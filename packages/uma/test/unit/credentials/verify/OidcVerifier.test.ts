import * as accessTokenVerifier from '@solid/access-token-verifier';
import { JWTPayload } from 'jose';
import * as jose from 'jose';
import { MockInstance } from 'vitest';
import { Credential } from '../../../../src/credentials/Credential';
import { OidcVerifier } from '../../../../src/credentials/verify/OidcVerifier';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(),
  decodeJwt: vi.fn(),
  jwtVerify: vi.fn(),
}));

describe('OidcVerifier', (): void => {
  const issuer = 'http://example.org/issuer';
  const baseUrl = 'http://example.com/uma';
  const credential: Credential = {
    format: 'http://openid.net/specs/openid-connect-core-1_0.html#IDToken',
    token: 'token',
  };

  const decodedToken: JWTPayload = {
    sub: 'sub',
    iss: issuer,
    aud: baseUrl,
  };
  const remoteKeySet = 'remoteKeySet';
  const decodeJwt = vi.spyOn(jose, 'decodeJwt');
  const jwtVerify = vi.spyOn(jose, 'jwtVerify');
  const createRemoteJWKSet = vi.spyOn(jose, 'createRemoteJWKSet');
  const fetchMock = vi.spyOn(global, 'fetch');
  const verifierMock = vi.fn();
  vi.spyOn(accessTokenVerifier, 'createSolidTokenVerifier').mockReturnValue(verifierMock);
  let verifier: OidcVerifier;

  beforeEach(async(): Promise<void> => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({ jwks_uri: `${issuer}/jwks_uri` }),
    } as any);
    decodeJwt.mockReturnValue(decodedToken);
    jwtVerify.mockResolvedValue({ payload: decodedToken } as any);
    createRemoteJWKSet.mockReturnValue(remoteKeySet as any);

    verifierMock.mockResolvedValue({
      webid: 'webId',
      client_id: 'clientId'
    });

    verifier = new OidcVerifier(baseUrl)
  });

  it('errors on non-OIDC credentials.', async(): Promise<void> => {
    await expect(verifier.verify({ format: 'wrong', token: 'token' })).rejects
      .toThrow("Token format wrong does not match this processor's format.");
  });

  it('errors if the issuer is not allowed.', async(): Promise<void> => {
    verifier = new OidcVerifier(baseUrl, [ 'otherIssuer' ]);
    await expect(verifier.verify(credential)).rejects.toThrow('Unsupported issuer');

    verifier = new OidcVerifier(baseUrl, [ issuer ]);
    await expect(verifier.verify(credential)).resolves.toEqual({
      ['urn:solidlab:uma:claims:types:webid']: 'sub',
    });
  });

  describe('parsing a Solid OIDC token', (): void => {
    beforeEach(async(): Promise<void> => {
      decodeJwt.mockReturnValue({ ...decodedToken, aud: [ baseUrl, 'solid' ] });
    });

    it('returns the extracted WebID.', async(): Promise<void> => {
      await expect(verifier.verify(credential)).resolves.toEqual({
        ['urn:solidlab:uma:claims:types:webid']: 'webId',
        ['urn:solidlab:uma:claims:types:clientid']: 'clientId',
      });
    });

    it('throws an error if the token could not be verified.', async(): Promise<void> => {
      verifierMock.mockRejectedValueOnce(new Error('bad data'));
      await expect(verifier.verify(credential)).rejects.toThrow('Error verifying OIDC ID Token: bad data');
    });
  });

  describe('parsing a standard OIDC token', (): void => {
    it('errors if the sub claim is missing', async(): Promise<void> => {
      jwtVerify.mockResolvedValue({ payload: { ...decodedToken, sub: undefined } } as any);
      await expect(verifier.verify(credential)).rejects.toThrow('Invalid OIDC token: missing `sub` claim');
    });

    it('returns the extracted identity.', async(): Promise<void> => {
      await expect(verifier.verify(credential)).resolves.toEqual({
        ['urn:solidlab:uma:claims:types:webid']: 'sub',
      });
    });

    it('returns the extracted client identifier.', async(): Promise<void> => {
      jwtVerify.mockResolvedValue({ payload: { ...decodedToken, azp: 'client' } } as any);

      await expect(verifier.verify(credential)).resolves.toEqual({
        ['urn:solidlab:uma:claims:types:webid']: 'sub',
        ['urn:solidlab:uma:claims:types:clientid']: 'client',
      });
    });
  });
});
