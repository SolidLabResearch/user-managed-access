import {BadRequestHttpError} from '../http/errors/BadRequestHttpError';
import {HttpHandlerContext} from '../http/models/HttpHandlerContext';
import {NeedInfoError} from '../error/NeedInfoError';
import {RequestDeniedError} from '../error/RequestDeniedError';
import {Ticket} from '../models/Ticket';
import {Principal} from '../models/AccessToken';
import {UmaGrantProcessor} from './UmaGrantProcessor';
import { KeyValueStore } from '../storage/models/KeyValueStore.ts';
const mockTicketStore: KeyValueStore<string, Ticket> = {
  get: jest.fn(), 
  has: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  entries: jest.fn(),
};
const mockTokenFactory = {serialize: jest.fn(), deserialize: jest.fn()};
const mockAuthorizer = {authorize: jest.fn()};
const mockClaimTokenProcessor = {process: jest.fn(),
  claimTokenFormat: jest.fn(() => 'urn:authorization-agent:dummy-token')};

const TOKEN_URI = new URL('https://uma.example.com/token');
const WEBID = 'https://example.com/profile/alice#me';
const WEBID_BIS = 'https://example.com/profile/carol#me';

const CLIENT = 'https://projectapp.com';
const RESOURCE = 'https://pods.example.com/test/123.ttl';

describe('Happy Flows', () => {
  const umaGrantProcessor = new UmaGrantProcessor([mockClaimTokenProcessor], [mockAuthorizer],
      mockTicketStore, mockTokenFactory);
  let requestContext: HttpHandlerContext;

  const sub = {iri: RESOURCE};
  const ticket: Ticket = [{
    resource_id: RESOURCE,
    resource_scopes: ['read'],
  }];
  const principal: Principal = {webId: WEBID, clientId: CLIENT};
  const authorizedModes = new Set(['read', 'write']);

  beforeEach(() => {
    requestContext = {
      request: {
        url: TOKEN_URI,
        method: 'POST',
        body: '',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
      },
    };
    jest.resetAllMocks();
  });

  test('Should support UMA Grant Type', () => {
    expect(umaGrantProcessor.getSupportedGrantType()).toEqual('urn:ietf:params:oauth:grant-type:uma-ticket');
  });

  test('Should process valid request', async () => {
    const grantedModes = new Set(['read']);
    mockClaimTokenProcessor.process.mockReturnValue(new Promise((resolve) =>
      resolve(principal)));
    // mockTicketStore.deserialize.mockReturnValue(new Promise((resolve) => resolve(ticket)));
    mockAuthorizer.authorize.mockReturnValue(new Promise((resolve) => resolve(authorizedModes)));
    mockTokenFactory.serialize.mockReturnValue(new Promise((resolve) => resolve({token: 'token123',
      tokenType: 'Bearer'})));

    const body = new Map([['claim_token', 'abc'],
      ['claim_token_format', 'token'],
      ['ticket', '123'],
    ]);

    const result = await umaGrantProcessor.process(body, requestContext);
    expect(mockClaimTokenProcessor.process).toHaveBeenCalledWith({url: TOKEN_URI, method: 'POST',
      claim_token: 'abc', claim_token_format: 'token'});
    // expect(mockTicketStore.deserialize).toHaveBeenCalledWith('123');
    expect(mockAuthorizer.authorize).toHaveBeenCalledWith(principal, ticket);
    expect(mockTokenFactory.serialize).toHaveBeenCalledWith({...principal, modes: grantedModes, sub});
    expect(result).toEqual({access_token: 'token123', token_type: 'Bearer'});
  });

  test('Should pass through DPoP Header', async () => {
    requestContext.request.headers['dpop'] = 'dpop123';
    const grantedModes = new Set(['read']);
    mockClaimTokenProcessor.process.mockReturnValue(new Promise((resolve) =>
      resolve(principal)));
    // mockTicketStore.deserialize.mockReturnValue(new Promise((resolve) => resolve(ticket)));
    mockAuthorizer.authorize.mockReturnValue(new Promise((resolve) => resolve(authorizedModes)));
    mockTokenFactory.serialize.mockReturnValue(new Promise((resolve) => resolve({token: 'token123',
      tokenType: 'Bearer'})));

    const body = new Map([
      ['claim_token', 'abc'],
      ['claim_token_format', 'token'],
      ['ticket', '123'],
    ]);

    const result = await umaGrantProcessor.process(body, requestContext);
    expect(mockClaimTokenProcessor.process).toHaveBeenCalledWith({url: TOKEN_URI, method: 'POST',
      claim_token: 'abc', claim_token_format: 'token', dpop: 'dpop123'});
    // expect(mockTicketStore.deserialize).toHaveBeenCalledWith('123');
    expect(mockAuthorizer.authorize).toHaveBeenCalledWith(principal, ticket);
    expect(mockTokenFactory.serialize).toHaveBeenCalledWith({...principal, modes: grantedModes, sub});
    expect(result).toEqual({access_token: 'token123', token_type: 'Bearer'});
  });

  test('Should pass through RPT', async () => {
    const grantedModes = new Set(['read']);
    mockClaimTokenProcessor.process.mockReturnValue(new Promise((resolve) =>
      resolve(principal)));
    // mockTicketStore.deserialize.mockReturnValue(new Promise((resolve) => resolve(ticket)));
    mockAuthorizer.authorize.mockReturnValue(new Promise((resolve) => resolve(authorizedModes)));
    mockTokenFactory.serialize.mockReturnValue(new Promise((resolve) => resolve({token: 'token123',
      tokenType: 'Bearer'})));

    const body = new Map([
      ['claim_token', 'abc'],
      ['claim_token_format', 'token'],
      ['ticket', '123'],
      ['rpt', 'rpt123'],
    ]);

    const result = await umaGrantProcessor.process(body, requestContext);
    expect(mockClaimTokenProcessor.process).toHaveBeenCalledWith({url: TOKEN_URI, method: 'POST',
      claim_token: 'abc', claim_token_format: 'token', rpt: 'rpt123'});
    // expect(mockTicketStore.deserialize).toHaveBeenCalledWith('123');
    expect(mockAuthorizer.authorize).toHaveBeenCalledWith(principal, ticket);
    expect(mockTokenFactory.serialize).toHaveBeenCalledWith({...principal, modes: grantedModes, sub});
    expect(result).toEqual({access_token: 'token123', token_type: 'Bearer'});
  });
});

describe('Sad Flows', () => {
  const umaGrantProcessor = new UmaGrantProcessor([mockClaimTokenProcessor], [mockAuthorizer],
      mockTicketStore, mockTokenFactory);
  let requestContext: HttpHandlerContext;

  const sub = {iri: RESOURCE};
  const ticket: Ticket = [{
    resource_id: RESOURCE,
    resource_scopes: ['read'],
  }];
  const principal: Principal = {webId: WEBID, clientId: CLIENT};

  beforeEach(() => {
    requestContext = {
      request: {
        url: TOKEN_URI,
        method: 'POST',
        body: '',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
      },
    };
    jest.resetAllMocks();
  });
  test('Missing `ticket` in body should throw error', () => {
    const body = new Map([
      ['claim_token', 'abc'],
      ['claim_token_format', 'token'],
    ]);

    expect(async () => await umaGrantProcessor.process(body, requestContext)).rejects.toThrowError(BadRequestHttpError);
    expect(async () => await umaGrantProcessor.process(body, requestContext)).rejects
        .toThrowError('The request is missing one of the required body parameters:'+
    ' {\'ticket\', \'claim_token\', \'claim_token_format\'}');
  });

  test('Missing `claim_token` in body should throw error', () => {
    const body = new Map([
      ['claim_token_format', 'abc'],
      ['ticket', '123'],
    ]);

    expect(async () => await umaGrantProcessor.process(body, requestContext)).rejects.toThrowError(BadRequestHttpError);
    expect(async () => await umaGrantProcessor.process(body, requestContext)).rejects
        .toThrowError('The request is missing one of the required body parameters:'+
    ' {\'ticket\', \'claim_token\', \'claim_token_format\'}');
  });

  test('Missing `claim_token_format` in body should throw error', () => {
    const body = new Map([
      ['claim_token', 'abc'],
      ['ticket', '123'],
    ]);

    expect(async () => await umaGrantProcessor.process(body, requestContext)).rejects.toThrowError(BadRequestHttpError);
    expect(async () => await umaGrantProcessor.process(body, requestContext)).rejects
        .toThrowError('The request is missing one of the required body parameters:'+
    ' {\'ticket\', \'claim_token\', \'claim_token_format\'}');
  });

  test('Unauthorized request should throw error', async () => {
    mockClaimTokenProcessor.process.mockReturnValue(new Promise((resolve) =>
      resolve(principal)));
    // mockTicketStore.deserialize.mockReturnValue(new Promise((resolve) => resolve(ticket)));
    mockAuthorizer.authorize.mockReturnValue(new Promise((resolve) => resolve(new Set())));

    const body = new Map([
      ['claim_token', 'abc'],
      ['claim_token_format', 'token'],
      ['ticket', '123'],
    ]);

    try {
      await umaGrantProcessor.process(body, requestContext);
    } catch (e) {
      expect(e).toBeInstanceOf(RequestDeniedError);
    }

    expect(mockClaimTokenProcessor.process).toHaveBeenCalledWith({url: TOKEN_URI, method: 'POST',
      claim_token: 'abc', claim_token_format: 'token'});
    // expect(mockTicketStore.deserialize).toHaveBeenCalledWith('123');
    expect(mockAuthorizer.authorize).toHaveBeenCalledWith(principal, ticket);
  });

  test('Invalid claim_token should re-throw error', async () => {
    mockClaimTokenProcessor.process.mockRejectedValueOnce(new Error('invalid'));
    const body = new Map([
      ['claim_token', 'abc'],
      ['claim_token_format', 'token'],
      ['ticket', '123'],
    ]);
    try {
      await umaGrantProcessor.process(body, requestContext);
    } catch (e) {
      expect(e).toBeInstanceOf(NeedInfoError);
    }
  });

  test('Unsupported claim_token_format should throw error', async () => {
    mockClaimTokenProcessor.process.mockReturnValue(new Promise((resolve) =>
      resolve(undefined)));
    const body = new Map([
      ['claim_token', 'abc'],
      ['claim_token_format', 'token'],
      ['ticket', '123'],
    ]);
    try {
      await umaGrantProcessor.process(body, requestContext);
    } catch (e) {
      expect(e).toBeInstanceOf(NeedInfoError);
    }
  });
});
