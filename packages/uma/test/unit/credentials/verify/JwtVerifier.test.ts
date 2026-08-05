import * as jose from 'jose';
import { Credential } from '../../../../src/credentials/Credential';
import { JwtVerifier } from '../../../../src/credentials/verify/JwtVerifier';

vi.mock('jose');

describe('JwtVerifier', (): void => {
  const decodeMock = vi.spyOn(jose, 'decodeJwt');
  const verifyMock = vi.spyOn(jose, 'jwtVerify');

  const issuer = 'http://example.com/issuer';
  const credential: Credential = {
    format: 'urn:solidlab:uma:claims:formats:jwt',
    token: 'token',
  };
  const allowedClaims: string[] = [ 'iss', 'claim1' ];
  let verifier: JwtVerifier;

  beforeEach(async(): Promise<void> => {
    vi.clearAllMocks();

    decodeMock.mockReturnValue({
      iss: issuer,
      claim1: 'val1',
      claim2: 'val2',
    });

    verifier = new JwtVerifier(allowedClaims, false, false);
  });

  it('errors on non-JWT credentials.', async(): Promise<void> => {
    await expect(verifier.verify({ format: 'wrong', token: 'token' })).rejects
      .toThrow("Token format 'wrong' does not match this processor's format.");
  });

  it('returns the allowed claims.', async(): Promise<void> => {
    await expect(verifier.verify(credential)).resolves.toEqual({ iss: [ issuer ], claim1: [ 'val1' ], });
    expect(decodeMock).toHaveBeenCalledTimes(1);
    expect(decodeMock).toHaveBeenLastCalledWith(credential.token);

    // Verification is off
    expect(verifyMock).toHaveBeenCalledTimes(0);
  });

  it('errors on extra claims if the option is enabled.', async(): Promise<void> => {
    verifier = new JwtVerifier(allowedClaims, true, false);
    await expect(verifier.verify(credential)).rejects.toThrow("Claim 'claim2' not allowed");
  });

  describe('with verification enabled.', (): void => {
    const remoteKeySet = 'remoteKeySet';
    const fetchMock = vi.spyOn(global, 'fetch');
    const createRemoteJWKSet = vi.spyOn(jose, 'createRemoteJWKSet');

    beforeEach(async(): Promise<void> => {
      fetchMock.mockResolvedValue({
        status: 200,
        json: vi.fn().mockResolvedValue({
          issuer,
          jwks_uri: `${issuer}/jwks_uri`
        }),
      } as any);
      createRemoteJWKSet.mockReturnValue(remoteKeySet as any);

      verifier = new JwtVerifier(allowedClaims, false, true);
    });

    it('errors if the token does not contain an iss.', async(): Promise<void> => {
      decodeMock.mockReturnValueOnce({ claim1: 'val1', claim2: 'val2' });
      await expect(verifier.verify(credential)).rejects.toThrow("JWT should contain 'iss' claim.");
    });

    it('verifies the token.', async(): Promise<void> => {
      await expect(verifier.verify(credential)).resolves.toEqual({ iss: [ issuer ], claim1: [ 'val1' ], });
      expect(decodeMock).toHaveBeenCalledTimes(1);
      expect(decodeMock).toHaveBeenLastCalledWith(credential.token);
      expect(verifyMock).toHaveBeenCalledTimes(1);
      expect(verifyMock).toHaveBeenLastCalledWith(credential.token, remoteKeySet);
    });
  });
});
