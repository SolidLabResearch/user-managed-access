import {createSolidTokenVerifier} from '@solid/access-token-verifier';
import {DpopClaimTokenProcessor} from './DpopClaimTokenProcessor';

const solidTokenVerifier = createSolidTokenVerifier() as jest.MockedFunction<any>;

describe('Unhappy Flows', () => {
  const dpopClaimTokenProcessor = new DpopClaimTokenProcessor();
  beforeEach((): void => {
    jest.clearAllMocks();
  });

  test('Should return undefined for unsupported format', async () => {
    expect(await dpopClaimTokenProcessor.process({claim_token_format: 'abc', claim_token: 'token-123',
      url: new URL('http://example.com/token'), method: 'POST'})).toBeUndefined();
  });

  test('Should throw error for missing DPoP', async () => {
    expect(async () => await dpopClaimTokenProcessor.process({claim_token_format: 'http://openid.net/specs/openid-connect-core-1_0.html#IDToken', claim_token: 'token-123',
      url: new URL('http://example.com/token'), method: 'POST'})).rejects.toThrowError('DPoP Header is missing.');
  });
  test('When token verifier throws error, should throw error as well.', async () => {
    solidTokenVerifier.mockImplementationOnce((): void => {
      throw new Error('invalid');
    });
    expect(async () => await dpopClaimTokenProcessor.process({claim_token_format: 'http://openid.net/specs/openid-connect-core-1_0.html#IDToken', claim_token: 'token-123',
      url: new URL('http://example.com/token'), dpop: 'token-456', method: 'POST'})).rejects.toThrowError('Error verifying Access Token via WebID: invalid');
  });
});


describe('Happy Flows', () => {
  const dpopClaimTokenProcessor = new DpopClaimTokenProcessor();
  beforeEach((): void => {
    jest.clearAllMocks();
  });

  test('Should call token verifier', async () => {
    const result = await dpopClaimTokenProcessor.process({claim_token_format: 'http://openid.net/specs/openid-connect-core-1_0.html#IDToken', claim_token: 'token-123',
      dpop: 'token-456',
      url: new URL('http://example.com/token'), method: 'POST'});
    expect(solidTokenVerifier).toHaveBeenCalledTimes(1);
    expect(solidTokenVerifier).toHaveBeenCalledWith('DPoP token-123', {header: 'token-456', method: 'POST', url: 'http://example.com/token'});
    expect(result).toEqual({webId: 'http://alice.example/card#me', clientId: 'http://example.com/app'});
  });

  test('Should return supported claim format', () => {
    expect(dpopClaimTokenProcessor.claimTokenFormat()).toEqual('http://openid.net/specs/openid-connect-core-1_0.html#IDToken');
  });
});
