import { UnsecureVerifier } from '../../../../src/credentials/verify/UnsecureVerifier';

describe('UnsecureVerifier', (): void => {
  const verifier = new UnsecureVerifier();

  it('errors if the format is not correct.', async(): Promise<void> => {
    await expect(verifier.verify({ format: 'wrong', token: 'token' })).rejects
      .toThrow("Token format wrong does not match this processor's format.");
  });

  it('errors if the token cannot be split correctly.', async(): Promise<void> => {
    await expect(verifier.verify({ format: 'urn:solidlab:uma:claims:formats:webid', token: 'to:k:en' })).rejects
      .toThrow("Invalid token format, only one ':' is expected.");
  });

  it('parses the token as a WebID.', async(): Promise<void> => {
    await expect(verifier.verify({
      format: 'urn:solidlab:uma:claims:formats:webid',
      token: encodeURIComponent('http://example.com/#me'),
    })).resolves.toEqual({
      ['urn:solidlab:uma:claims:types:webid']: 'http://example.com/#me',
      ['urn:solidlab:uma:claims:types:clientid']: false,
    });
  });

  it('parses the second part of the token as client ID if there is one.', async(): Promise<void> => {
    await expect(verifier.verify({
      format: 'urn:solidlab:uma:claims:formats:webid',
      token: `${encodeURIComponent('http://example.com/#me')}:${encodeURIComponent('http://example.com/#client')}`,
    })).resolves.toEqual({
      ['urn:solidlab:uma:claims:types:webid']: 'http://example.com/#me',
      ['urn:solidlab:uma:claims:types:clientid']: 'http://example.com/#client',
    });
  });

  it('throws an error if something goes wrong.', async(): Promise<void> => {
    await expect(verifier.verify({
      format: 'urn:solidlab:uma:claims:formats:webid',
      token: 'notAURL',
    })).rejects.toThrow('Error verifying Access Token via WebID: Invalid URL');
  });
});
