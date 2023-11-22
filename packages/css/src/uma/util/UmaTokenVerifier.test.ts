/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import * as jose from 'jose';
import {verifyUMAToken} from './UmaTokenVerifier';

jest.mock('jose', () => {
  return {
    createRemoteJWKSet: jest.fn(),
    jwtVerify: jest.fn(),
  };
});

const MOCK_RESOURCE = 'https://pod.example.org/test/123';
const MOCK_AUD = 'solid';
const MOCK_WEBID = 'https://id.example.org/test/123';
const MOCK_CLIENT = 'https://app.example.org/';
const MOCK_MODES = ['http://www.w3.org/ns/auth/acl#Read'];

const MOCK_AS_URL = 'https://as.example.org';
const MOCK_CONFIG = {
  issuer: MOCK_AS_URL,
  jwks_uri: `${MOCK_AS_URL}/jwks`,
  jwks: undefined,
  permission_registration_endpoint: `${MOCK_AS_URL}/register`,
};

describe('A UmaTokenVerifier', () => {
  beforeAll(() => {
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when token validation is requested', () => {
    it('and token is valid, should return parsed token', async () => {
      (jose.jwtVerify as unknown as jest.Mock).mockImplementation(async () => {
        return {payload: {
          sub: MOCK_RESOURCE,
          webid: MOCK_WEBID,
          azp: MOCK_CLIENT,
          modes: MOCK_MODES,
        },
        };
      },
      );

      expect(await verifyUMAToken('abc', MOCK_CONFIG, {baseUrl: MOCK_AUD, maxTokenAge: 600})).toEqual({
        webid: MOCK_WEBID,
        azp: MOCK_CLIENT,
        resource: MOCK_RESOURCE,
        modes: MOCK_MODES,
      });
      expect(jose.jwtVerify).toHaveBeenCalledTimes(1);
      expect(jose.jwtVerify).toHaveBeenCalledWith('abc', undefined, {
        'issuer': MOCK_AS_URL,
        'audience': MOCK_AUD,
        'maxTokenAge': 600,
      });
    });

    test.each`
    missing    | payload    | error
    ${'sub'} | ${{webid: MOCK_WEBID, azp: MOCK_CLIENT, modes: MOCK_MODES}} | ${'UMA Access Token is missing \'sub\' claim.'}
    ${'webid'} | ${{sub: MOCK_RESOURCE, azp: MOCK_CLIENT, modes: MOCK_MODES}} | ${'UMA Access Token is missing \'webid\' claim.'}
    ${'azp'} | ${{sub: MOCK_RESOURCE, webid: MOCK_WEBID, modes: MOCK_MODES}} | ${'UMA Access Token is missing \'azp\' claim.'}
    ${'modes'} | ${{sub: MOCK_RESOURCE, webid: MOCK_WEBID, azp: MOCK_CLIENT}} | ${'UMA Access Token is missing \'modes\' claim.'}
    `('and token is missing $missing, should throw error', ({missing, payload, expected}) => {
      (jose.jwtVerify as unknown as jest.Mock).mockImplementation(async () => {
        return {payload: payload,
        };
      },
      );

      expect(async () => await verifyUMAToken('abc', MOCK_CONFIG, {baseUrl: MOCK_AUD, maxTokenAge: 600})).rejects
          .toThrowError(expected);
      expect(jose.jwtVerify).toHaveBeenCalledTimes(1);
      expect(jose.jwtVerify).toHaveBeenCalledWith('abc', undefined, {
        'issuer': MOCK_AS_URL,
        'audience': MOCK_AUD,
        'maxTokenAge': 600,
      });
    });

    test.each`
    invalid    | payload    | error
    ${'webid'} | ${{webid: 123, sub: MOCK_RESOURCE, azp: MOCK_CLIENT, modes: MOCK_MODES}} | ${'UMA Access Token is missing \'webid\' claim.'}
    ${'azp'} | ${{webid: MOCK_WEBID, sub: MOCK_RESOURCE, azp: 123, modes: MOCK_MODES}} | ${'UMA Access Token is missing \'azp\' claim.'}
    ${'modes'} | ${{webid: MOCK_WEBID, sub: MOCK_RESOURCE, azp: MOCK_CLIENT, modes: 'abc'}} | ${'UMA Access Token is missing \'modes\' claim.'}
    `('and token has non-string claim $invalid, should throw error', ({invalid, payload, expected}) => {
      (jose.jwtVerify as unknown as jest.Mock).mockImplementation(async () => {
        return {payload: payload,
        };
      },
      );

      expect(async () => await verifyUMAToken('abc', MOCK_CONFIG, {baseUrl: MOCK_AUD, maxTokenAge: 600})).rejects
          .toThrowError(expected);
      expect(jose.jwtVerify).toHaveBeenCalledTimes(1);
      expect(jose.jwtVerify).toHaveBeenCalledWith('abc', undefined, {
        'issuer': MOCK_AS_URL,
        'audience': MOCK_AUD,
        'maxTokenAge': 600,
      });
    });
  });
});
