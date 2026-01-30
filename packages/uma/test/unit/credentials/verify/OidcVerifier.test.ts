import * as accessTokenVerifier from '@solid/access-token-verifier';
import { KeyValueStorage } from '@solid/community-server';
import { JWTPayload } from 'jose';
import * as jose from 'jose';
import { Mocked, MockInstance } from 'vitest';
import { ACCESS } from '../../../../src/credentials/Claims';
import { Credential } from '../../../../src/credentials/Credential';
import { ACCESS_TOKEN } from '../../../../src/credentials/Formats';
import { OidcVerifier } from '../../../../src/credentials/verify/OidcVerifier';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(),
  decodeJwt: vi.fn(),
  jwtVerify: vi.fn(),
}));

describe('OidcVerifier', (): void => {
  const issuer = 'http://example.org/issuer';
  const baseUrl = 'http://example.com/uma';
  let credential: Credential;

  let decodedToken: JWTPayload;
  const remoteKeySet = 'remoteKeySet';
  const decodeJwt = vi.spyOn(jose, 'decodeJwt');
  const jwtVerify = vi.spyOn(jose, 'jwtVerify');
  const createRemoteJWKSet = vi.spyOn(jose, 'createRemoteJWKSet');
  const fetchMock = vi.spyOn(global, 'fetch');
  const verifierMock = vi.fn();
  vi.spyOn(accessTokenVerifier, 'createSolidTokenVerifier').mockReturnValue(verifierMock);
  let derivationStore: Mocked<KeyValueStorage<string, string>>
  let verifier: OidcVerifier;

  beforeEach(async(): Promise<void> => {
    credential = {
      format: 'http://openid.net/specs/openid-connect-core-1_0.html#IDToken',
      token: 'token',
    };

    decodedToken =  {
      sub: 'sub',
      iss: issuer,
      aud: baseUrl,
    };

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

    derivationStore = {
      get: vi.fn(),
    } satisfies Partial<KeyValueStorage<string, string>> as any;

    verifier = new OidcVerifier(baseUrl, derivationStore);
  });

  it('errors on non-OIDC credentials.', async(): Promise<void> => {
    await expect(verifier.verify({ format: 'wrong', token: 'token' })).rejects
      .toThrow("Token format wrong does not match this processor's format.");
  });

  it('errors if the issuer is not allowed.', async(): Promise<void> => {
    verifier = new OidcVerifier(baseUrl, derivationStore, [ 'otherIssuer' ]);
    await expect(verifier.verify(credential)).rejects.toThrow('Unsupported issuer');

    verifier = new OidcVerifier(baseUrl, derivationStore, [ issuer ]);
    await expect(verifier.verify(credential)).resolves.toEqual({
      ['urn:solidlab:uma:claims:types:webid']: 'sub',
    });
  });

  describe('parsing a Solid OIDC token', (): void => {
    beforeEach(async(): Promise<void> => {
      decodeJwt.mockReturnValue({ ...decodedToken, aud: [ baseUrl, 'solid' ], webid: 'webId' });
    });

    it('returns the extracted WebID.', async(): Promise<void> => {
      await expect(verifier.verify(credential)).resolves.toEqual({
        ['urn:solidlab:uma:claims:types:webid']: 'webId',
        ['urn:solidlab:uma:claims:types:clientid']: 'clientId',
      });
    });

    it('throws an error if the token could not be verified.', async(): Promise<void> => {
      verifierMock.mockRejectedValueOnce(new Error('bad data'));
      await expect(verifier.verify(credential)).rejects.toThrow('Error verifying OIDC Token: bad data');
    });
  });

  describe('parsing a standard OIDC token', (): void => {
    it('errors if the sub claim is missing', async(): Promise<void> => {
      jwtVerify.mockResolvedValue({ payload: { ...decodedToken, sub: undefined } } as any);
      await expect(verifier.verify(credential)).rejects.toThrow('Invalid OIDC ID token: missing `sub` claim');
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

  describe('parsing access tokens', (): void => {
    beforeEach(async(): Promise<void> => {
      credential.format = 'urn:ietf:params:oauth:token-type:access_token';
    });

    it('returns the matching derivation-read access claims.', async(): Promise<void> => {
      decodedToken.permissions = [
        { resource_id: 'id1', resource_scopes: [ 'scope1', 'urn:knows:uma:scopes:derivation-read' ] },
        { resource_id: 'id2', resource_scopes: [ 'scope2', 'urn:knows:uma:scopes:derivation-read' ] },
        { resource_id: 'id3', resource_scopes: [ 'scope3' ] },
      ];
      decodedToken.iss = 'issuer';
      derivationStore.get.mockImplementation(async (id) => 'issuer');
      await expect(verifier.verify(credential)).resolves.toEqual({
        ['urn:solidlab:uma:claims:types:access']: [
          { resource_id: 'id1', resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ] },
          { resource_id: 'id2', resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ] },
        ],
      });
    });

    it('errors on issuer mismatch.', async(): Promise<void> => {
      decodedToken.permissions = [
        { resource_id: 'id1', resource_scopes: [ 'scope1', 'urn:knows:uma:scopes:derivation-read' ] },
      ];
      decodedToken.iss = 'wrong-issuer';
      derivationStore.get.mockImplementation(async (id) => 'issuer');
      await expect(verifier.verify(credential)).rejects
        .toThrow('Invalid issuer for id1, expected issuer but got wrong-issuer');
    });
  });
});
