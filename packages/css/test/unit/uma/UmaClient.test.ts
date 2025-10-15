import {
  AccessMap,
  IdentifierSetMultiMap,
  IdentifierStrategy,
  KeyValueStorage,
  NotFoundHttpError,
  ResourceSet
} from '@solid/community-server';
import { PERMISSIONS } from '@solidlab/policy-engine';
import { EventEmitter } from 'events';
import * as jose from 'jose';
import { Mocked, MockInstance } from 'vitest';
import { flushPromises } from '../../../../../test/util/Util';
import { UmaClient, UmaConfig } from '../../../src/uma/UmaClient';
import { Fetcher } from '../../../src/util/fetch/Fetcher';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

class PublicUmaClient extends UmaClient {
  public inProgressResources: Set<string> = new Set();
  public registerEmitter: EventEmitter = new EventEmitter();
}

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(),
  decodeJwt: vi.fn(),
  jwtVerify: vi.fn(),
}));

describe('UmaClient', (): void => {
  const issuer = 'issuer';
  const umaConfig: UmaConfig = {
    issuer,
    jwks_uri: 'http://example.com/jwks_uri',
    permission_endpoint: 'http://example.com/permission_endpoint',
    introspection_endpoint: 'http://example.com/introspection_endpoint',
    resource_registration_endpoint: 'http://example.com/resource_registration_endpoint/',
  }
  let response: Mocked<Writeable<Response>>;

  let umaIdStore: Mocked<KeyValueStorage<string, string>>;
  let fetcher: Mocked<Fetcher>;
  let identifierStrategy: Mocked<IdentifierStrategy>;
  let resourceSet: Mocked<ResourceSet>;

  let client: UmaClient;

  beforeEach(async(): Promise<void> => {
    response = {
      status: 200,
      json: vi.fn().mockResolvedValue(umaConfig),
    } satisfies Partial<Response> as any;

    umaIdStore = {
      get: vi.fn(),
      set: vi.fn(),
    } satisfies Partial<KeyValueStorage<string, string>> as any;
    fetcher = {
      fetch: vi.fn().mockResolvedValue(response),
    };
    identifierStrategy = {
      isRootContainer: vi.fn((id) => id.path === '/'),
      getParentContainer: vi.fn((id) => ({ path: id.path.slice(0, id.path.slice(0, -1).lastIndexOf('/') + 1) })),
    } satisfies Partial<IdentifierStrategy> as any;
    resourceSet = {
      hasResource: vi.fn(),
    };

    client = new UmaClient(umaIdStore, fetcher, identifierStrategy, resourceSet);
  });

  describe('.fetchUmaConfig', (): void => {
    it('errors if there was an issue fetching the UMA configuration.', async(): Promise<void> => {
      response.status = 400;
      await expect(client.fetchUmaConfig(issuer)).rejects
        .toThrow(new Error("Unable to retrieve UMA Configuration for Authorization Server 'issuer'" +
          " from 'issuer/.well-known/uma2-configuration'"));
      expect(fetcher.fetch).toHaveBeenCalledTimes(1);
      expect(fetcher.fetch).toHaveBeenLastCalledWith('issuer/.well-known/uma2-configuration');
    });

    it('errors if not all required fields are present in the response.', async(): Promise<void> => {
      response.json.mockResolvedValueOnce({});
      await expect(client.fetchUmaConfig(issuer)).rejects
        .toThrow(new Error("The Authorization Server Metadata of 'issuer' is missing attributes " +
          "issuer, jwks_uri, permission_endpoint, introspection_endpoint, resource_registration_endpoint"));
      expect(fetcher.fetch).toHaveBeenCalledTimes(1);
      expect(fetcher.fetch).toHaveBeenLastCalledWith('issuer/.well-known/uma2-configuration');
    });

    it('errors if some of the required fields have a non-string value.', async(): Promise<void> => {
      response.json.mockResolvedValueOnce({
        issuer: 1, jwks_uri: 2, permission_endpoint: 3, introspection_endpoint: 4, resource_registration_endpoint: 5,
      });
      await expect(client.fetchUmaConfig(issuer)).rejects
        .toThrow(new Error("The Authorization Server Metadata of 'issuer' should have string attributes " +
          "issuer, jwks_uri, permission_endpoint, introspection_endpoint, resource_registration_endpoint"));
      expect(fetcher.fetch).toHaveBeenCalledTimes(1);
      expect(fetcher.fetch).toHaveBeenLastCalledWith('issuer/.well-known/uma2-configuration');
    });

    it('returns the UMA configuration.', async(): Promise<void> => {
      await expect(client.fetchUmaConfig(issuer)).resolves.toEqual(umaConfig);
    });
  });

  describe('.fetchTicket', (): void => {
    let permissions: AccessMap;

    // Creating class to mock the internal resource registration as that testing is handled separately
    class SimpleRegistrationUmaClient extends UmaClient {
      public registerResource = vi.fn();
    }

    beforeEach(async(): Promise<void> => {
      permissions = new IdentifierSetMultiMap<string>([
        [ { path: 'target1' }, PERMISSIONS.Read ],
        [ { path: 'target2' }, PERMISSIONS.Modify ],
      ]);

      // Config mock for first fetch call
      fetcher.fetch.mockResolvedValueOnce(response);
    });

    it('errors if there was an issue getting the configuration.', async(): Promise<void> => {
      response.status = 400;
      await expect(client.fetchTicket(permissions, issuer)).rejects.toThrow("Error while retrieving ticket: " +
        "Unable to retrieve UMA Configuration for Authorization Server 'issuer'" +
        " from 'issuer/.well-known/uma2-configuration'");
    });

    it('fetches the ticket from the UMA server.', async(): Promise<void> => {
      // Ticket mock
      fetcher.fetch.mockResolvedValueOnce({
        ...response,
        status: 201,
        json: vi.fn().mockResolvedValueOnce({ ticket: 'ticket' }),
      });
      umaIdStore.get.mockResolvedValueOnce('uma1');
      umaIdStore.get.mockResolvedValueOnce('uma2');
      await expect(client.fetchTicket(permissions, issuer)).resolves.toBe('ticket');
      expect(fetcher.fetch).toHaveBeenCalledTimes(2);
      expect(fetcher.fetch).toHaveBeenNthCalledWith(2, umaConfig.permission_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify([
          { resource_id: 'uma1', resource_scopes: [`urn:example:css:modes:read`] },
          { resource_id: 'uma2', resource_scopes: [`urn:example:css:modes:write`] }
        ]),
      });
    });

    it('returns undefined if no ticket is needed.', async(): Promise<void> => {
      fetcher.fetch.mockResolvedValueOnce({
        ...response,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({ ticket: 'ticket' }),
      });
      umaIdStore.get.mockResolvedValueOnce('uma1');
      umaIdStore.get.mockResolvedValueOnce('uma2');
      await expect(client.fetchTicket(permissions, issuer)).resolves.toBeUndefined();
    });

    it('waits for resource registration if it is in progress.', async(): Promise<void> => {
      vi.useFakeTimers();
      umaIdStore.get.mockResolvedValueOnce(undefined);
      umaIdStore.get.mockResolvedValueOnce('uma1');
      umaIdStore.get.mockResolvedValueOnce('uma2');

      const publicClient = new PublicUmaClient(umaIdStore, fetcher, identifierStrategy, resourceSet);
      publicClient.inProgressResources.add('target1');
      const prom = publicClient.fetchTicket(permissions, issuer);
      await flushPromises();
      vi.advanceTimersByTime(1000);
      publicClient.registerEmitter.emit('target1');

      await expect(prom).resolves.toBeUndefined();
      expect(fetcher.fetch).toHaveBeenNthCalledWith(2, umaConfig.permission_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify([
          { resource_id: 'uma1', resource_scopes: [`urn:example:css:modes:read`] },
          { resource_id: 'uma2', resource_scopes: [`urn:example:css:modes:write`] }
        ]),
      });

      vi.useRealTimers();
    });

    it('errors if resource registration takes too long.', async(): Promise<void> => {
      vi.useFakeTimers();
      umaIdStore.get.mockResolvedValueOnce(undefined);
      umaIdStore.get.mockResolvedValueOnce('uma1');
      umaIdStore.get.mockResolvedValueOnce('uma2');

      const publicClient = new PublicUmaClient(umaIdStore, fetcher, identifierStrategy, resourceSet);
      publicClient.inProgressResources.add('target1');
      const prom = publicClient.fetchTicket(permissions, issuer);
      await flushPromises();
      vi.advanceTimersByTime(3000);

      await expect(prom).rejects.toThrow('Unable to finish registration for target1');
      vi.useRealTimers();
    });

    it('errors trying to fetch a ticket for a resource that does not exist.', async(): Promise<void> => {
      umaIdStore.get.mockResolvedValueOnce(undefined);
      resourceSet.hasResource.mockResolvedValueOnce(false);
      await expect(client.fetchTicket(permissions, issuer)).rejects.toThrow(NotFoundHttpError);
      expect(resourceSet.hasResource).toHaveBeenCalledTimes(1);
      expect(resourceSet.hasResource).toHaveBeenLastCalledWith({ path: 'target1' });
    });

    it('tries to register a resource if it exists without UMA ID.', async(): Promise<void> => {
      const registerClient = new SimpleRegistrationUmaClient(umaIdStore, fetcher, identifierStrategy, resourceSet);
      umaIdStore.get.mockResolvedValueOnce(undefined);
      resourceSet.hasResource.mockResolvedValueOnce(true);
      umaIdStore.get.mockResolvedValueOnce('uma1');
      umaIdStore.get.mockResolvedValueOnce('uma2');

      await expect(registerClient.fetchTicket(permissions, issuer)).resolves.toBeUndefined();
      expect(registerClient.registerResource).toHaveBeenCalledTimes(1);
      expect(registerClient.registerResource).toHaveBeenLastCalledWith({ path: 'target1' }, issuer);
      expect(fetcher.fetch).toHaveBeenCalledTimes(2);
      expect(fetcher.fetch).toHaveBeenNthCalledWith(2, umaConfig.permission_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify([
          { resource_id: 'uma1', resource_scopes: [`urn:example:css:modes:read`] },
          { resource_id: 'uma2', resource_scopes: [`urn:example:css:modes:write`] }
        ]),
      });
    });

    it('errors if there is still no UMA ID after registering the resource.', async(): Promise<void> => {
      const registerClient = new SimpleRegistrationUmaClient(umaIdStore, fetcher, identifierStrategy, resourceSet);
      umaIdStore.get.mockResolvedValue(undefined);
      resourceSet.hasResource.mockResolvedValueOnce(true);

      await expect(registerClient.fetchTicket(permissions, issuer)).rejects
        .toThrow(`Unable to request ticket: no UMA ID found for target1`);
      expect(registerClient.registerResource).toHaveBeenCalledTimes(1);
      expect(registerClient.registerResource).toHaveBeenLastCalledWith({ path: 'target1' }, issuer);
    });
  });

  describe('.verifyJwtToken', (): void => {
    const token = 'token';
    const issuers = [ 'issuer' ];
    const jwkSet = 'jwkSet';
    let decodeJwt: MockInstance<typeof jose.decodeJwt>;
    let jwtVerify: MockInstance<typeof jose.jwtVerify>;
    let createRemoteJWKSet: MockInstance<typeof jose.createRemoteJWKSet>;

    beforeEach(async(): Promise<void> => {
      decodeJwt = vi.spyOn(jose, 'decodeJwt');
      jwtVerify = vi.spyOn(jose, 'jwtVerify');
      createRemoteJWKSet = vi.spyOn(jose, 'createRemoteJWKSet');

      // Config mock for first fetch call
      fetcher.fetch.mockResolvedValueOnce(response);
    });

    it('errors if the token contains no issuer.', async(): Promise<void> => {
      decodeJwt.mockReturnValueOnce({});
      await expect(client.verifyJwtToken(token, issuers)).rejects
        .toThrow('The JWT does not contain an "iss" parameter.');
      expect(decodeJwt).toHaveBeenCalledTimes(1);
      expect(decodeJwt).toHaveBeenLastCalledWith(token);
    });

    it('errors if the issuer is not valid.', async(): Promise<void> => {
      decodeJwt.mockReturnValueOnce({ iss: 'other' });
      await expect(client.verifyJwtToken(token, issuers)).rejects
        .toThrow(`The JWT wasn't issued by one of the target owners' issuers.`);
      expect(decodeJwt).toHaveBeenCalledTimes(1);
      expect(decodeJwt).toHaveBeenLastCalledWith(token);
    });

    it('errors if something else goes wrong decoding the token.', async(): Promise<void> => {
      decodeJwt.mockImplementationOnce(() => { throw new Error('bad data') });
      await expect(client.verifyJwtToken(token, issuers)).rejects
        .toThrow(`Error verifying UMA access token: bad data`);
      expect(decodeJwt).toHaveBeenCalledTimes(1);
      expect(decodeJwt).toHaveBeenLastCalledWith(token);
    });

    it('returns the payload if it contains no permissions if it is verified.', async(): Promise<void> => {
      const decoded = { iss: 'issuer', key: 'value' };
      decodeJwt.mockReturnValueOnce(decoded);
      createRemoteJWKSet.mockResolvedValueOnce(jwkSet as any);
      jwtVerify.mockResolvedValueOnce({ payload: decoded } as any);

      await expect(client.verifyJwtToken(token, issuers)).resolves.toEqual(decoded);
      expect(decodeJwt).toHaveBeenCalledTimes(1);
      expect(decodeJwt).toHaveBeenLastCalledWith(token);
      expect(createRemoteJWKSet).toHaveBeenCalledTimes(1);
      expect(createRemoteJWKSet).toHaveBeenLastCalledWith(new URL(umaConfig.jwks_uri));
      expect(jwtVerify).toHaveBeenCalledTimes(1);
      expect(jwtVerify).toHaveBeenLastCalledWith(token, jwkSet, { issuer: issuer, audience: 'solid' });
    });

    it('errors if the permission array is invalid.', async(): Promise<void> => {
      const decoded = { iss: 'issuer', key: 'value', permissions: [{}] };
      decodeJwt.mockReturnValueOnce(decoded);
      createRemoteJWKSet.mockResolvedValueOnce(jwkSet as any);
      jwtVerify.mockResolvedValueOnce({ payload: decoded } as any);

      await expect(client.verifyJwtToken(token, issuers)).rejects.toThrow("Invalid RPT: 'permissions' array invalid.");
      expect(decodeJwt).toHaveBeenCalledTimes(1);
      expect(decodeJwt).toHaveBeenLastCalledWith(token);
      expect(createRemoteJWKSet).toHaveBeenCalledTimes(1);
      expect(createRemoteJWKSet).toHaveBeenLastCalledWith(new URL(umaConfig.jwks_uri));
      expect(jwtVerify).toHaveBeenCalledTimes(1);
      expect(jwtVerify).toHaveBeenLastCalledWith(token, jwkSet, { issuer: issuer, audience: 'solid' });
    });

    it('returns the payload if the permissions are valid.', async(): Promise<void> => {
      const decoded = { iss: 'issuer', key: 'value', permissions: [
        { resource_id: 'id1', resource_scopes: [ 'scope1' ] },
        { resource_id: 'id2', resource_scopes: [ 'scope21', 'scope22' ] },
      ] };
      decodeJwt.mockReturnValueOnce(decoded);
      createRemoteJWKSet.mockResolvedValueOnce(jwkSet as any);
      jwtVerify.mockResolvedValueOnce({ payload: decoded } as any);

      await expect(client.verifyJwtToken(token, issuers)).resolves.toEqual(decoded);
      expect(decodeJwt).toHaveBeenCalledTimes(1);
      expect(decodeJwt).toHaveBeenLastCalledWith(token);
      expect(createRemoteJWKSet).toHaveBeenCalledTimes(1);
      expect(createRemoteJWKSet).toHaveBeenLastCalledWith(new URL(umaConfig.jwks_uri));
      expect(jwtVerify).toHaveBeenCalledTimes(1);
      expect(jwtVerify).toHaveBeenLastCalledWith(token, jwkSet, { issuer: issuer, audience: 'solid' });
    });
  });

  describe('verifyOpaqueToken', (): void => {
    const token = 'token';
    const jwkSet = 'jwkSet';
    let jwtVerify: MockInstance<typeof jose.jwtVerify>;
    let createRemoteJWKSet: MockInstance<typeof jose.createRemoteJWKSet>;

    beforeEach(async(): Promise<void> => {
      jwtVerify = vi.spyOn(jose, 'jwtVerify');
      createRemoteJWKSet = vi.spyOn(jose, 'createRemoteJWKSet');

      // Config mock for first fetch call
      fetcher.fetch.mockResolvedValueOnce(response);
    });

    it('errors if the introspection endpoint returns a 400+ response.', async(): Promise<void> => {
      const resp = { ...response, status: 400 };
      fetcher.fetch.mockResolvedValueOnce(resp);
      await expect(client.verifyOpaqueToken(token, issuer))
        .rejects.toThrow("Unable to introspect UMA RPT for Authorization Server 'issuer'");
    });

    it('errors if the token is not active.', async(): Promise<void> => {
      const resp = { ...response, status: 200, json: vi.fn().mockResolvedValue({ active: 'false' }) };
      fetcher.fetch.mockResolvedValueOnce(resp);
      await expect(client.verifyOpaqueToken(token, issuer))
        .rejects.toThrow('The provided UMA RPT is not active.');
    });

    it('returns the introspected payload if the token is active and valid.', async(): Promise<void> => {
      const resp = {
        ...response,
        status: 200,
        json: vi.fn().mockResolvedValue({ active: 'true' })
      };
      const decoded = { iss: 'issuer', key: 'value' };
      fetcher.fetch.mockResolvedValueOnce(resp);
      createRemoteJWKSet.mockResolvedValueOnce(jwkSet as any);
      jwtVerify.mockResolvedValueOnce({ payload: decoded } as any);
      await expect(client.verifyOpaqueToken(token, issuer)).resolves.toEqual(decoded);
      expect(createRemoteJWKSet).toHaveBeenCalledTimes(1);
      expect(createRemoteJWKSet).toHaveBeenLastCalledWith(new URL(umaConfig.jwks_uri));
      expect(jwtVerify).toHaveBeenCalledTimes(1);
      expect(jwtVerify).toHaveBeenLastCalledWith({ active: 'true' }, jwkSet, { issuer: issuer, audience: 'solid' });
    });
  });

  describe('.registerResource', (): void => {
    const umaId = 'umaId';
    const resource_scopes = [
      'urn:example:css:modes:read',
      'urn:example:css:modes:append',
      'urn:example:css:modes:create',
      'urn:example:css:modes:delete',
      'urn:example:css:modes:write',
    ];
    const resource_defaults = { 'http://www.w3.org/ns/ldp#contains': resource_scopes };

    beforeEach(async(): Promise<void> => {
      fetcher.fetch.mockResolvedValueOnce(response);
    });

    it('can register the root container.', async(): Promise<void> => {
      const resp = { ...response, status: 201, json: vi.fn().mockResolvedValueOnce({ _id: umaId }) };
      fetcher.fetch.mockResolvedValueOnce(resp);
      await expect(client.registerResource({ path: '/' }, issuer)).resolves.toBeUndefined();
      expect(umaIdStore.get).toHaveBeenCalledTimes(1);
      expect(umaIdStore.get).toHaveBeenLastCalledWith('/');
      expect(umaIdStore.set).toHaveBeenCalledTimes(1);
      expect(umaIdStore.set).toHaveBeenLastCalledWith('/', umaId);
      expect(fetcher.fetch).toHaveBeenCalledTimes(2);
      expect(fetcher.fetch).toHaveBeenNthCalledWith(2, umaConfig.resource_registration_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ name: '/', resource_scopes, resource_defaults }),
      });
    });

    it('updates a resource if it was already registered.', async(): Promise<void> => {
      umaIdStore.get.mockResolvedValueOnce(umaId);
      await expect(client.registerResource({ path: '/' }, issuer)).resolves.toBeUndefined();
      expect(umaIdStore.get).toHaveBeenCalledTimes(1);
      expect(umaIdStore.get).toHaveBeenLastCalledWith('/');
      expect(umaIdStore.set).toHaveBeenCalledTimes(0);
      expect(fetcher.fetch).toHaveBeenCalledTimes(2);
      expect(fetcher.fetch).toHaveBeenNthCalledWith(2, umaConfig.resource_registration_endpoint + umaId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ name: '/', resource_scopes, resource_defaults }),
      });
    });

    it('includes parent relations if the parent is registered.', async(): Promise<void> => {
      umaIdStore.get.mockImplementation(async(id) => id === '/' ? 'parentId' : undefined);
      const resp = { ...response, status: 201, json: vi.fn().mockResolvedValueOnce({ _id: umaId }) };
      fetcher.fetch.mockResolvedValueOnce(resp);
      await expect(client.registerResource({ path: '/foo' }, issuer)).resolves.toBeUndefined();
      expect(umaIdStore.get).toHaveBeenCalledTimes(2);
      expect(umaIdStore.get).nthCalledWith(1, '/foo');
      expect(umaIdStore.get).nthCalledWith(2, '/');
      expect(umaIdStore.set).toHaveBeenCalledTimes(1);
      expect(umaIdStore.set).toHaveBeenLastCalledWith('/foo', umaId);
      expect(fetcher.fetch).toHaveBeenCalledTimes(2);
      expect(fetcher.fetch).toHaveBeenNthCalledWith(2, umaConfig.resource_registration_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ name: '/foo', resource_scopes, resource_relations: { '@reverse': { 'http://www.w3.org/ns/ldp#contains': [ 'parentId' ] }}}),
      });
    });

    it('updates the relations later if the parent is not registered.', async(): Promise<void> => {
      const umaIds: Record<string, string> = {};
      umaIdStore.get.mockImplementation(async(id) => umaIds[id]);
      umaIdStore.set.mockImplementation(async(id, val): Promise<any> => umaIds[id] = val);

      const registerChild = { ...response, status: 201, json: vi.fn().mockResolvedValueOnce({ _id: umaId }) };
      const registerParent = { ...response, status: 201, json: vi.fn().mockResolvedValueOnce({ _id: 'parentId' }) };
      fetcher.fetch.mockImplementation(async(target, req) => {
        if (target === umaConfig.resource_registration_endpoint) {
          return JSON.parse(req!.body as string).name === '/' ? registerParent : registerChild;
        }
        return response;
      });

      await expect(client.registerResource({ path: '/foo' }, issuer)).resolves.toBeUndefined();
      expect(umaIdStore.set).toHaveBeenCalledTimes(2);
      expect(umaIdStore.set).toHaveBeenCalledWith('/foo', umaId);
      expect(umaIdStore.set).toHaveBeenCalledWith('/', 'parentId');
      expect(fetcher.fetch).toHaveBeenCalledTimes(6);
      expect(fetcher.fetch).toHaveBeenCalledWith(umaConfig.resource_registration_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ name: '/foo', resource_scopes }),
      });
      expect(fetcher.fetch).toHaveBeenCalledWith(umaConfig.resource_registration_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ name: '/', resource_scopes, resource_defaults }),
      });
      expect(fetcher.fetch).toHaveBeenCalledWith(umaConfig.resource_registration_endpoint + umaId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ name: '/foo', resource_scopes, resource_relations: { '@reverse': { 'http://www.w3.org/ns/ldp#contains': [ 'parentId' ] }}}),
      });
    });
  });

  describe('.deleteResource', (): void => {
    beforeEach(async(): Promise<void> => {
      fetcher.fetch.mockResolvedValueOnce(response);
    });

    it('errors if there is no matching UMA identifier.', async(): Promise<void> => {
      await expect(client.deleteResource({ path: '/foo' }, issuer)).rejects
        .toThrow('Trying to remove UMA registration that is not known: /foo');
    });

    it('performs a DELETE request.', async(): Promise<void> => {
      umaIdStore.get.mockResolvedValueOnce('umaId');
      await expect(client.deleteResource({ path: '/foo' }, issuer)).resolves.toBeUndefined();
      expect(fetcher.fetch).toHaveBeenCalledTimes(2);
      expect(fetcher.fetch).nthCalledWith(2, umaConfig.resource_registration_endpoint + 'umaId', {
        method: 'DELETE',
      });
    });
  });
});
