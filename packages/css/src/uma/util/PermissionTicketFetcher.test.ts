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
