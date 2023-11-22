/* eslint-disable require-jsdoc */
import fetch from 'node-fetch';
import {fetchUMAConfig} from './UmaConfigFetcher';

jest.mock('jose', () => {
  return {
    createRemoteJWKSet: jest.fn(),
  };
});

jest.mock('node-fetch', () => jest.fn());

const MOCK_AS_URL = 'https://as.example.org';
const MOCK_CONFIG = {
  issuer: MOCK_AS_URL,
  jwks_uri: `${MOCK_AS_URL}/jwks`,
  jwks: undefined,
  permission_registration_endpoint: `${MOCK_AS_URL}/register`,
};

describe('A UmaConfigFetcher', () => {
  beforeAll(() => {
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when the UMA configuration is requested', () => {
    it('and configuration is valid, should return configuration', async () => {
      (fetch as unknown as jest.Mock).mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => {
            return MOCK_CONFIG;
          },
        };
      },
      );

      expect(await fetchUMAConfig(MOCK_AS_URL)).toEqual(MOCK_CONFIG);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(`${MOCK_AS_URL}/.well-known/uma2-configuration`, undefined);
    });

    it('and configuration is unavailable, should throw error', async () => {
      (fetch as unknown as jest.Mock).mockImplementation(async () => {
        return {
          ok: true,
          status: 400,
        };
      },
      );

      expect(async () => await fetchUMAConfig(MOCK_AS_URL)).rejects.toThrowError('Unable to retrieve UMA Configuration for Authorization Server \'https://as.example.org\'');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(`${MOCK_AS_URL}/.well-known/uma2-configuration`, undefined);
    });

    it('and configuration is empty, should throw error', async () => {
      (fetch as unknown as jest.Mock).mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => {
            return {
            };
          },
        };
      },
      );

      expect(async () => await fetchUMAConfig(MOCK_AS_URL)).rejects.toThrowError('The UMA Configuration for Authorization Server \'https://as.example.org\' is missing required attributes "issuer", "jwks_uri", "permission_registration_endpoint"');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(`${MOCK_AS_URL}/.well-known/uma2-configuration`, undefined);
    });
    it('and configuration is invalid, should throw error', async () => {
      (fetch as unknown as jest.Mock).mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => {
            return {
              issuer: 12345,
              jwks_uri: {},
              permission_registration_endpoint: {},
            };
          },
        };
      },
      );

      expect(async () => await fetchUMAConfig(MOCK_AS_URL)).rejects.toThrowError('The UMA Configuration for Authorization Server \'https://as.example.org\' should have string attributes \"issuer\", \"jwks_uri\", \"permission_registration_endpoint\"');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(`${MOCK_AS_URL}/.well-known/uma2-configuration`, undefined);
    });
  });
});
