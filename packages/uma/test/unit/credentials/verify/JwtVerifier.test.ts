import * as getJwks from 'get-jwks';
import * as jose from 'jose';
import { Credential } from '../../../../src/credentials/Credential';
import { JwtVerifier } from '../../../../src/credentials/verify/JwtVerifier';

vi.mock('get-jwks');
vi.mock('jose');

describe('JwtVerifier', (): void => {
  const getJwkMock = vi.fn();
  const getJwksMock = vi.spyOn(getJwks, 'default').mockReturnValue({
    getJwk: getJwkMock,
  } as any);
  const decodeMock = vi.spyOn(jose, 'decodeJwt');
  const decodeHeaderMock = vi.spyOn(jose, 'decodeProtectedHeader');
  const verifyMock = vi.spyOn(jose, 'jwtVerify');

  const issuer = 'issuer';
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

    decodeHeaderMock.mockReturnValue({
      alg: 'alg',
      kid: 'kid',
    });

    getJwkMock.mockResolvedValue({ key: 'value' });

    verifier = new JwtVerifier(allowedClaims, false, false);
  });

  it('errors on non-JWT credentials.', async(): Promise<void> => {
    await expect(verifier.verify({ format: 'wrong', token: 'token' })).rejects
      .toThrow("Token format 'wrong' does not match this processor's format.");
  });

  it('returns the allowed claims.', async(): Promise<void> => {
    await expect(verifier.verify(credential)).resolves.toEqual({ iss: issuer, claim1: 'val1', });
    expect(decodeMock).toHaveBeenCalledTimes(1);
    expect(decodeMock).toHaveBeenLastCalledWith(credential.token);

    // Verification is off
    expect(decodeHeaderMock).toHaveBeenCalledTimes(0);
    expect(getJwkMock).toHaveBeenCalledTimes(0);
    expect(verifyMock).toHaveBeenCalledTimes(0);
  });

  it('errors on extra claims if the option is enabled.', async(): Promise<void> => {
    verifier = new JwtVerifier(allowedClaims, true, false);
    await expect(verifier.verify(credential)).rejects.toThrow("Claim 'claim2' not allowed");
  });

  describe('with verification enabled.', (): void => {

    beforeEach(async(): Promise<void> => {
      verifier = new JwtVerifier(allowedClaims, false, true);
    });

    it('errors if the token does not contain an iss.', async(): Promise<void> => {
      decodeMock.mockReturnValueOnce({ claim1: 'val1', claim2: 'val2' });
      await expect(verifier.verify(credential)).rejects.toThrow("JWT should contain 'iss' claim.");
    });

    it('errors if the header does not contain an alg.', async(): Promise<void> => {
      decodeHeaderMock.mockReturnValueOnce({ kid: 'kid' });
      await expect(verifier.verify(credential)).rejects.toThrow("JWT should contain 'alg' header.");
    });

    it('errors if the header does not contain a kid.', async(): Promise<void> => {
      decodeHeaderMock.mockReturnValueOnce({ alg: 'alg' });
      await expect(verifier.verify(credential)).rejects.toThrow("JWT should contain 'kid' header.");
    });

    it('verifies the token.', async(): Promise<void> => {
      await expect(verifier.verify(credential)).resolves.toEqual({ iss: issuer, claim1: 'val1', });
      expect(decodeMock).toHaveBeenCalledTimes(1);
      expect(decodeMock).toHaveBeenLastCalledWith(credential.token);
      expect(decodeHeaderMock).toHaveBeenCalledTimes(1);
      expect(decodeHeaderMock).toHaveBeenLastCalledWith(credential.token);
      expect(getJwkMock).toHaveBeenCalledTimes(1);
      expect(getJwkMock).toHaveBeenLastCalledWith({ domain: 'issuer', alg: 'alg', kid: 'kid' });
      expect(verifyMock).toHaveBeenCalledTimes(1);
      expect(verifyMock).toHaveBeenLastCalledWith(credential.token, { key: 'value', type: 'JWK' });
    });
  });
});
