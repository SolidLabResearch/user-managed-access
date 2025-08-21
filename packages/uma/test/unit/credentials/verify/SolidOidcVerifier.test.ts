import * as accessTokenVerifier from '@solid/access-token-verifier';
import { Credential } from '../../../../src/credentials/Credential';
import { SolidOidcVerifier } from '../../../../src/credentials/verify/SolidOidcVerifier';

describe('SolidOidcVerifier', (): void => {
  const credential: Credential = {
    format: 'http://openid.net/specs/openid-connect-core-1_0.html#IDToken',
    token: 'token',
  };

  const verifierMock = vi.fn();
  vi.spyOn(accessTokenVerifier, 'createSolidTokenVerifier').mockReturnValue(verifierMock);
  let verifier: SolidOidcVerifier;

  beforeEach(async(): Promise<void> => {
    vi.clearAllMocks();
    verifierMock.mockResolvedValue({
      webid: 'webId',
      client_id: 'clientId',
      aud: 'solid',
      iss: 'issuer',
      iat: 5,
      exp: 6,
    });

    verifier = new SolidOidcVerifier()
  });

  it('errors on non-OIDC credentials.', async(): Promise<void> => {
    await expect(verifier.verify({ format: 'wrong', token: 'token' })).rejects
      .toThrow("Token format wrong does not match this processor's format.");
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
