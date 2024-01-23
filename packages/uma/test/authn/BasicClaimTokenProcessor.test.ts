import {BasicClaimTokenProcessor} from './BasicClaimTokenProcessor';

const TOKEN_URL = new URL('https://example.org/token');

const claimTokenProcessor = new BasicClaimTokenProcessor();
describe('Unhappy Flows', () => {
  test('Should return undefined for unsupported token type', async () => {
    expect(await claimTokenProcessor.process({
      url: TOKEN_URL,
      method: 'POST',
      claim_token: 'abc',
      claim_token_format: 'urn:example:test',
    })).toBeUndefined();
  });
  test('Should throw error for invalid formatted token', async () => {
    expect(async () => await claimTokenProcessor.process({
      url: TOKEN_URL,
      method: 'POST',
      claim_token: 'abc:def:ghi',
      claim_token_format: 'urn:authorization-agent:dummy-token',
    })).rejects.toThrowError('Error verifying Access Token via WebID: ' +
    'Invalid token format, only one \':\' is expected.');
  });
  test('Should throw error for non-URL WebID', async () => {
    expect(async () => await claimTokenProcessor.process({
      url: TOKEN_URL,
      method: 'POST',
      claim_token: `abc:${encodeURIComponent('https://example.org/app')}`,
      claim_token_format: 'urn:authorization-agent:dummy-token',
    })).rejects.toThrowError('Error verifying Access Token via WebID: ' +
    'Invalid URL');
  });
  test('Should throw error for non-URL ClientID', async () => {
    expect(async () => await claimTokenProcessor.process({
      url: TOKEN_URL,
      method: 'POST',
      claim_token: `${encodeURIComponent('https://example.org/id')}:abc`,
      claim_token_format: 'urn:authorization-agent:dummy-token',
    })).rejects.toThrowError('Error verifying Access Token via WebID: ' +
    'Invalid URL');
  });
});

describe('Happy Flows', () => {
  test('Valid token should return Principal', async () => {
    expect(await claimTokenProcessor.process({
      url: TOKEN_URL,
      method: 'POST',
      claim_token: `${encodeURIComponent('https://example.org/id')}:${encodeURIComponent('https://example.org/app')}`,
      claim_token_format: 'urn:authorization-agent:dummy-token',
    })).toEqual({webId: 'https://example.org/id', clientId: 'https://example.org/app'});
  });
  test('Valid token without ClientId should return Principal', async () => {
    expect(await claimTokenProcessor.process({
      url: TOKEN_URL,
      method: 'POST',
      claim_token: `${encodeURIComponent('https://example.org/id')}`,
      claim_token_format: 'urn:authorization-agent:dummy-token',
    })).toEqual({webId: 'https://example.org/id'});
  });
  test('Should return supported claim format', () => {
    expect(claimTokenProcessor.claimTokenFormat()).toEqual('urn:authorization-agent:dummy-token');
  });
});
