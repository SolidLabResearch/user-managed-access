import * as jose from 'jose';
import { Credential } from '../../../../src/credentials/Credential';
import { VcVerifier } from '../../../../src/credentials/verify/VcVerifier';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(),
  decodeJwt: vi.fn(),
  jwtVerify: vi.fn(),
}));

describe('VcVerifier', (): void => {
  const issuer = 'http://example.org/issuer';
  let credential: Credential;
  let decodedToken: any;
  const remoteKeySet = 'remoteKeySet';

  const decodeJwt = vi.spyOn(jose, 'decodeJwt');
  const jwtVerify = vi.spyOn(jose, 'jwtVerify');
  const createRemoteJWKSet = vi.spyOn(jose, 'createRemoteJWKSet');
  const fetchMock = vi.spyOn(global, 'fetch');

  let verifier: VcVerifier;

  beforeEach(async(): Promise<void> => {
    credential = {
      format: 'application/vc+jwt',
      token: 'token',
    };

    decodedToken =  {
      iss: issuer,
      vc: {
        issuanceDate: new Date(Date.now() - 5000).toISOString(),
        expirationDate: new Date(Date.now() + 5000).toISOString(),
        credentialSubject: { garden: { fruit: 'apple' } },
      }
    };

    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({
        issuer,
        jwks_uri: `${issuer}/jwks_uri`
      }),
    } as any);
    decodeJwt.mockReturnValue(decodedToken);
    jwtVerify.mockResolvedValue({ payload: decodedToken } as any);
    createRemoteJWKSet.mockReturnValue(remoteKeySet as any);

    verifier = new VcVerifier();
  });

  it('errors on non-VC credentials.', async(): Promise<void> => {
    await expect(verifier.verify({ format: 'wrong', token: 'token' })).rejects
      .toThrow(`Token format wrong does not match this processor's format.`);
  });

  it('errors if the token is missing the issuer claim.', async(): Promise<void> => {
    decodedToken.iss = undefined;

    await expect(verifier.verify(credential)).rejects
      .toThrow('Token is missing the issuer claim.');
  });

  it('errors if the token is missing the vc claim.', async(): Promise<void> => {
    decodedToken.vc = undefined;

    await expect(verifier.verify(credential)).rejects
      .toThrow('Token is missing the vc claim.');
  });

  it('errors if the VC is not yet valid.', async(): Promise<void> => {
    decodedToken.vc.issuanceDate = new Date(Date.now() + 5000).toISOString();

    await expect(verifier.verify(credential))
      .rejects.toThrow(`VC is not yet valid, issued at ${decodedToken.vc.issuanceDate}.`);
  });

  it('errors if the VC is expired.', async(): Promise<void> => {
    decodedToken.vc.expirationDate = new Date(Date.now() - 5000).toISOString();

    await expect(verifier.verify(credential)).rejects.toThrow(`VC expired at ${decodedToken.vc.expirationDate}.`);
  });

  it('errors if there is no credentialSubject.', async(): Promise<void> => {
    decodedToken.vc.credentialSubject = undefined;

    await expect(verifier.verify(credential)).rejects.toThrow('VC is missing the credentialSubject claim.');
  });

  it('returns the VC as claim.', async(): Promise<void> => {
    await expect(verifier.verify(credential)).resolves.toEqual({
      ['urn:solidlab:uma:claims:types:vc']: [ decodedToken.vc ],
    });
  });
});
