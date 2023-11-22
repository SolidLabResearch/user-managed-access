import { UmaTicketMetadataWriter } from './UmaTicketMetadataWriter';
import { createResponse } from 'node-mocks-http';
import { HTTP, HttpResponse, RepresentationMetadata, toObjectTerm } from '@solid/community-server';
import { AUTH, ACL } from '../../../util/Vocabularies';

const WEBID = 'http://example.org/123/profile';
const POD = 'http://example.org/456';
const mockExtendedAccountStore = {
  getWebIdSettings: jest.fn().mockImplementation(async () => new Map([
    [WEBID, {useIdp: true, clientCredentials: [], podBaseUrl: POD}],
  ])),
} as any;

const mockUmaClient = {
  getAsUrl: jest.fn().mockImplementation(() => 'https://as.example.org'),
  verifyToken: jest.fn(),
  fetchUMAConfig: jest.fn(),
  fetchPermissionTicket: jest.fn(),
};

describe('A UmaTicketMetadataWriter', () => {
  const writer = new UmaTicketMetadataWriter({accountStore: mockExtendedAccountStore,
    umaClient: mockUmaClient});
  let response: HttpResponse;

  beforeEach(() => {
    response = createResponse();
    mockUmaClient.fetchPermissionTicket.mockResolvedValueOnce('def');
  });

  afterEach(() => {
    mockUmaClient.fetchPermissionTicket.mockReset();
  });

  it('adds no header if there is no relevant metadata.', async (): Promise<void> => {
    const metadata = new RepresentationMetadata();
    await expect(writer.handle({response, metadata})).resolves.toBeUndefined();
    expect(response.getHeaders()).toEqual({ });
  });


  it('adds no header if the status code is not 401.', async (): Promise<void> => {
    const metadata = new RepresentationMetadata({[HTTP.statusCodeNumber]: '403'});
    await expect(writer.handle({response, metadata})).resolves.toBeUndefined();
    expect(response.getHeaders()).toEqual({ });
  });


  it('adds a WWW-Authenticate header if the status code is 401.', async (): Promise<void> => {
    const metadata = new RepresentationMetadata({[HTTP.statusCodeNumber]: '401',
      [AUTH.ticketNeeds]: [ACL.terms.Read], [AUTH.ticketSubject]: toObjectTerm(`${POD}/def`)});
    await expect(writer.handle({response, metadata})).resolves.toBeUndefined();

    expect(mockUmaClient.fetchPermissionTicket).toHaveBeenCalledTimes(1);
    expect(mockUmaClient.fetchPermissionTicket).toHaveBeenCalledWith({ticketSubject: 'http://example.org/456/def', owner: 'http://example.org/123/profile', ticketNeeds: new Set(['http://www.w3.org/ns/auth/acl#Read'])});
    expect(response.getHeaders()).toEqual({
      'www-authenticate': 'UMA realm=\"solid\",as_uri=\"https://as.example.org\",ticket=\"def\"',
    });
  });

  it('adds no header if the status code is 401 and the UMA ticket fetching errors.', async (): Promise<void> => {
    const metadata = new RepresentationMetadata({[HTTP.statusCodeNumber]: '401',
      [AUTH.ticketNeeds]: [ACL.terms.Read], [AUTH.ticketSubject]: toObjectTerm(`${POD}/def`)});
    mockUmaClient.fetchPermissionTicket.mockReset();
    mockUmaClient.fetchPermissionTicket.mockRejectedValueOnce(new Error('invalid'));
    await expect(writer.handle({response, metadata})).resolves.toBeUndefined();

    expect(mockUmaClient.fetchPermissionTicket).toHaveBeenCalledTimes(1);
    expect(mockUmaClient.fetchPermissionTicket).toHaveBeenCalledWith({ticketSubject: 'http://example.org/456/def', owner: 'http://example.org/123/profile', ticketNeeds: new Set(['http://www.w3.org/ns/auth/acl#Read'])});
    expect(response.getHeaders()).toEqual({});
  });

  it('adds no headers if the status code is 401 and the owner is found.', async (): Promise<void> => {
    const metadata = new RepresentationMetadata({[HTTP.statusCodeNumber]: '401',
      [AUTH.ticketNeeds]: [ACL.terms.Read], [AUTH.ticketSubject]: toObjectTerm(`https://example.org/def`)});
    await expect(writer.handle({response, metadata})).resolves.toBeUndefined();

    expect(response.getHeaders()).toEqual({});
  });
});
