import { AccessMode, BadRequestHttpError, HttpRequest, NotImplementedHttpError } from '@solid/community-server';
import { UmaToken } from '../uma/UmaClient';
import { CredentialGroup } from './Credentials';
import { UmaTokenExtractor } from './UmaTokenExtractor';

const MockUmaClient = {
  getAsUrl: jest.fn(),
  verifyToken: jest.fn(),
  fetchUMAConfig: jest.fn(),
  fetchPermissionTicket: jest.fn(),
};

const WEB_ID = 'https://example.org/alice';
const CLIENT = 'https://app.example.org';
const RESOURCE = 'https://pod.example.org/123';
const MODES = ['http://www.w3.org/ns/auth/acl#Read'];

const mockUmaToken: UmaToken = {webid: WEB_ID, azp: CLIENT,
  resource: RESOURCE, modes: MODES};

describe('A UMATicketExtractor', () => {
  const ticketExtractor = new UmaTokenExtractor({umaClient: MockUmaClient});
  afterEach((): void => {
    jest.clearAllMocks();
  });
  describe('on a request without Authorization header', () => {
    const request = {
      method: 'GET',
      headers: { },
    } as any as HttpRequest;
    it('throws an error', async () =>{
      const result = ticketExtractor.handleSafe(request);
      await expect(result).rejects.toThrow(NotImplementedHttpError);
      await expect(result).rejects.toThrow('No Bearer Authorization header specified.');
    });
  });

  describe('on a request without Bearer Authorization header', () => {
    const request = {
      method: 'GET',
      headers: {'authorization': 'Token 123'},
    } as any as HttpRequest;
    it('throws an error', async () =>{
      const result = ticketExtractor.handleSafe(request);
      await expect(result).rejects.toThrow(NotImplementedHttpError);
      await expect(result).rejects.toThrow('No Bearer Authorization header specified.');
    });
  });

  describe('on a request with Bearer Authorization header', () => {
    const request = {
      method: 'GET',
      headers: {'authorization': 'Bearer 123'},
    } as any as HttpRequest;

    beforeEach(() => {
      MockUmaClient.verifyToken.mockResolvedValueOnce(mockUmaToken);
    });

    it('calls the verifier with correct parameters', async () =>{
      await ticketExtractor.handleSafe(request);
      expect(MockUmaClient.verifyToken).toHaveBeenCalledTimes(1);
      expect(MockUmaClient.verifyToken).toHaveBeenCalledWith('123');
    });

    it('returns a CredentialSet with the ticket', async () =>{
      const result = ticketExtractor.handleSafe(request);
      await expect(result).resolves.toEqual({[CredentialGroup.ticket]: {webId: WEB_ID,
        resource: {path: RESOURCE},
        modes: new Set(['read'])}});
    });
  });

  describe('on a request with Bearer Authorization header and unsupported mode', () => {
    const request = {
      method: 'GET',
      headers: {'authorization': 'Bearer 123'},
    } as any as HttpRequest;

    beforeEach(() => {
      MockUmaClient.verifyToken.mockResolvedValueOnce({...mockUmaToken, modes: ['abc']});
    });

    it('throws an error.', async () =>{
      const result = ticketExtractor.handleSafe(request);
      await expect(result).rejects.toThrow(BadRequestHttpError);
      await expect(result).rejects.toThrow('Error verifying WebID via Bearer access token: ' +
      'Unknown ACL Mode \'abc\' in token.');
    });
  });

  describe('on a request with Authorization and a lowercase Bearer token', (): void => {
    const request = {
      method: 'GET',
      headers: {
        authorization: 'bearer 123',
      },
    } as any as HttpRequest;
    beforeEach(() => {
      MockUmaClient.verifyToken.mockResolvedValueOnce(mockUmaToken);
    });


    it('calls the verifier with correct parameters', async () =>{
      await ticketExtractor.handleSafe(request);
      expect(MockUmaClient.verifyToken).toHaveBeenCalledTimes(1);
      expect(MockUmaClient.verifyToken).toHaveBeenCalledWith('123');
    });
  });

  describe('when verification throws an error', (): void => {
    const request = {
      method: 'GET',
      headers: {
        authorization: 'Bearer token-1234',
      },
    } as any as HttpRequest;

    beforeEach((): void => {
      MockUmaClient.verifyToken.mockImplementationOnce((): void => {
        throw new Error('invalid');
      });
    });

    it('throws an error.', async (): Promise<void> => {
      const result = ticketExtractor.handleSafe(request);
      await expect(result).rejects.toThrow(BadRequestHttpError);
      await expect(result).rejects.toThrow('Error verifying WebID via Bearer access token: invalid');
    });
  });
});
