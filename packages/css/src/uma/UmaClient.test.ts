/* eslint-disable require-jsdoc */
import {UmaClient} from './UmaClient';
import {fetchUMAConfig} from './util/UmaConfigFetcher';
import {fetchPermissionTicket} from './util/PermissionTicketFetcher';
import {verifyUMAToken} from './util/UmaTokenVerifier';


jest.mock('./util/UmaConfigFetcher');
jest.mock('./util/PermissionTicketFetcher');
jest.mock('./util/UmaTokenVerifier');

const MOCK_AS_URL = 'https://as.example.org';
const BASE_URL = 'https://pods.example.org';

const MOCK_UMA_TOKEN = {webid: 'https://id.example.org/test/123',
  azp: 'https://app.example.org/',
  resource: 'https://pod.example.org/test/123',
  modes: ['http://www.w3.org/ns/auth/acl#Read'],
};

const MOCK_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
      MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgDr/w3aMO+Vib5zI6
      kRiJR3dD65qfE3X49PpSwR1efl+hRANCAATm5Yfzq2SK1tEFKwCWV6qIfgReMioJ
      oJJP7CSASenY6GuRl1ovbE2AgB1kmjFDu6LKT0ATxEZpBdaZW453br4L
      -----END PRIVATE KEY-----
      `;
const MOCK_CONFIG = {
  issuer: MOCK_AS_URL,
  jwks_uri: `${MOCK_AS_URL}/jwks`,
  permission_registration_endpoint: `${MOCK_AS_URL}/register`,
};

describe('A UmaClientImpl', () => {
  let umaClient: UmaClient;

  beforeEach(() => {
    umaClient = new UmaClientImpl({
      asUrl: MOCK_AS_URL,
      baseUrl: BASE_URL,
      maxTokenAge: 600,
      credentials: {
        ecAlgorithm: 'ES256',
        ecPrivateKey: MOCK_PRIVATE_KEY,
      },
    });
    (fetchUMAConfig as unknown as jest.Mock).mockImplementation(async () => MOCK_CONFIG);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return the authorization service URL', () => {
    expect(umaClient.getAsUrl()).toBe(MOCK_AS_URL);
  });

  it('should return UMA Configuration for AS', async () => {
    expect(await umaClient.fetchUMAConfig()).toEqual(MOCK_CONFIG);
  });

  describe('when verifying a UMA Token', () => {
    it('should resolve the UMA token if valid', async () => {
      (verifyUMAToken as unknown as jest.Mock).mockImplementation(async () => MOCK_UMA_TOKEN);
      expect(await umaClient.verifyToken('abc')).toEqual(MOCK_UMA_TOKEN);
      expect(verifyUMAToken).toHaveBeenCalled();
      expect(verifyUMAToken).toHaveBeenCalledWith('abc', MOCK_CONFIG, {baseUrl: BASE_URL, maxTokenAge: 600});
    });
    it('should rethrow error if invalid', async () => {
      (verifyUMAToken as unknown as jest.Mock).mockImplementation(async () => {
        throw new Error('invalid');
      });
      await expect(async () => await umaClient.verifyToken('abc')).rejects
          .toThrowError('Error verifying UMA access token: invalid');
      expect(verifyUMAToken).toHaveBeenCalled();
      expect(verifyUMAToken).toHaveBeenCalledWith('abc', MOCK_CONFIG, {baseUrl: BASE_URL, maxTokenAge: 600});
    });
  });

  describe('when fetching a permission ticket', () => {
    it('should yield a valid ticket when the request was successful', async () =>{
      (fetchPermissionTicket as unknown as jest.Mock).mockImplementation(async () => 'abc');
      expect(await umaClient.fetchPermissionTicket({ticketSubject: MOCK_UMA_TOKEN.resource,
        owner: MOCK_UMA_TOKEN.webid,
        ticketNeeds: new Set(MOCK_UMA_TOKEN.modes)})).toEqual('abc');
      expect(fetchPermissionTicket).toHaveBeenCalled();
    });
    it('should return undefined when an error has occurred', async () =>{
      (fetchPermissionTicket as unknown as jest.Mock).mockImplementation(async () => {
        throw new Error('invalid');
      });
      expect(await umaClient.fetchPermissionTicket({ticketSubject: MOCK_UMA_TOKEN.resource,
        owner: MOCK_UMA_TOKEN.webid,
        ticketNeeds: new Set(MOCK_UMA_TOKEN.modes)})).toBeUndefined();
      expect(fetchPermissionTicket).toHaveBeenCalled();
    });
  });
});


/* eslint-disable require-jsdoc */
import fetch from 'node-fetch';
import {fetchPermissionTicket} from './PermissionTicketFetcher';

jest.mock('node-fetch', () => jest.fn());

const MOCK_AS_URL = 'https://as.example.org';
const MOCK_REQUEST = {
  owner: 'https://example.org/profiles/123',
  ticketNeeds: new Set(['http://www.w3.org/ns/auth/acl#Read']),
  ticketSubject: 'https://example.org/pods/123',
};
const MOCK_OPTIONS = {
  permission_registration_endpoint: `${MOCK_AS_URL}/register`,
  bearer: 'def',
};
const MOCK_TICKET_RESPONSE = {
  ticket: 'abc',
};

describe('A PermissionTicketFetcher', () => {
  beforeAll(() => {
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when a permission registration is performed', () => {
    it('and request is valid, should return ticket', async () => {
      (fetch as unknown as jest.Mock).mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => {
            return MOCK_TICKET_RESPONSE;
          },
        };
      },
      );

      expect(await fetchPermissionTicket(MOCK_REQUEST, MOCK_OPTIONS)).toEqual('abc');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(`${MOCK_AS_URL}/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer def`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: MOCK_REQUEST.owner,
          resource_set_id: MOCK_REQUEST.ticketSubject,
          scopes: [...MOCK_REQUEST.ticketNeeds],
        }),
      });
    });
    it('and request fails, should throw error', async () => {
      (fetch as unknown as jest.Mock).mockImplementation(async () => {
        return {
          ok: true,
          status: 500,
        };
      },
      );

      expect(async () => await fetchPermissionTicket(MOCK_REQUEST, MOCK_OPTIONS)).rejects
          .toThrowError('Error while retrieving UMA Ticket: Received status 500 from \'https://as.example.org/register\'.');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(`${MOCK_AS_URL}/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer def`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: MOCK_REQUEST.owner,
          resource_set_id: MOCK_REQUEST.ticketSubject,
          scopes: [...MOCK_REQUEST.ticketNeeds],
        }),
      });
    });
    it('and responise is invalid, should throw error', async () => {
      (fetch as unknown as jest.Mock).mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => {
            return {};
          },
        };
      },
      );

      expect(async () => await fetchPermissionTicket(MOCK_REQUEST, MOCK_OPTIONS)).rejects
          .toThrowError('Invalid response from UMA AS: missing or invalid \'ticket\'.');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(`${MOCK_AS_URL}/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer def`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: MOCK_REQUEST.owner,
          resource_set_id: MOCK_REQUEST.ticketSubject,
          scopes: [...MOCK_REQUEST.ticketNeeds],
        }),
      });
    });
  });
});


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
