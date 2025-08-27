import {
  AccessMap,
  getLoggerFor,
  IdentifierStrategy,
  InternalServerError,
  isContainerIdentifier,
  joinUrl,
  KeyValueStorage,
  NotFoundHttpError,
  ResourceIdentifier,
  ResourceSet,
  SingleThreaded
} from '@solid/community-server';
import type { ResourceDescription } from '@solidlab/uma';
import { EventEmitter, once } from 'events';
import { createRemoteJWKSet, decodeJwt, JWTPayload, jwtVerify, JWTVerifyOptions } from 'jose';
import { promises } from 'node:timers';
import type { Fetcher } from '../util/fetch/Fetcher';

export interface Claims {
  [key: string]: unknown;
}

export interface UmaPermission {
  resource_id: string,
  resource_scopes: string[],
  exp?: number,
  iat?: number,
  nbf?: number,
}

export type UmaClaims = JWTPayload & {
  permissions?: UmaPermission[],
}

export interface UmaConfig {
  jwks_uri: string;
  // jwks: any;
  issuer: string;
  permission_endpoint: string;
  introspection_endpoint: string;
  resource_registration_endpoint: string;
}

export type UmaVerificationOptions = Omit<JWTVerifyOptions, 'iss' | 'aud' | 'sub' | 'iat'>;

const UMA_DISCOVERY = '/.well-known/uma2-configuration';

const REQUIRED_METADATA = [
  'issuer',
  'jwks_uri',
  'permission_endpoint',
  'introspection_endpoint',
  'resource_registration_endpoint'
];

/**
 * Client interface for the UMA AS.
 *
 * This class uses an EventEmitter and an in-memory map to keep track of registration progress,
 * so does not work with worker threads.
 */
export class UmaClient implements SingleThreaded {
  protected readonly logger = getLoggerFor(this);

  // Keeps track of resources that are being registered to prevent duplicate registration calls.
  protected readonly inProgressResources: Set<string> = new Set();
  // Used to notify when registration finished for a resource. The event will be the identifier of the resource.
  protected readonly registerEmitter: EventEmitter = new EventEmitter();

  /**
   * @param umaIdStore - Key/value store containing the resource path -> UMA ID bindings.
   * @param fetcher - Used to perform requests targeting the AS.
   * @param identifierStrategy - Utility functions based on the path configuration of the server.
   * @param resourceSet - Will be used to verify existence of resources.
   * @param options - JWT verification options.
   */
  constructor(
    protected readonly umaIdStore: KeyValueStorage<string, string>,
    protected readonly fetcher: Fetcher,
    protected readonly identifierStrategy: IdentifierStrategy,
    protected readonly resourceSet: ResourceSet,
    protected readonly options: UmaVerificationOptions = {},
  ) {
    // This number can potentially get very big when seeding a bunch of pods.
    // This is not really an issue, but it is still preferable to not have a warning printed.
    this.registerEmitter.setMaxListeners(20);
  }

  /**
   * Method to fetch a ticket from the Permission Registration endpoint of the UMA Authorization Service.
   *
   * @param {AccessMap} permissions - the access targets and modes for which a ticket is requested
   * @param {string} owner - the resource owner of the requested target resources
   * @param {string} issuer - the issuer from which to request the permission ticket
   * @return {Promise<string>} - the permission ticket
   */
  public async fetchTicket(permissions: AccessMap, issuer: string): Promise<string | undefined> {
    let endpoint: string;

    try {
      endpoint = (await this.fetchUmaConfig(issuer)).permission_endpoint;
    } catch (e: any) {
      throw new Error(`Error while retrieving ticket: ${(e as Error).message}`);
    }

    const body = [];
    for (const [ target, modes ] of permissions.entrySets()) {
      let umaId = await this.umaIdStore.get(target.path);
      if (!umaId && this.inProgressResources.has(target.path)) {
        // Wait for the resource to finish registration if it is still being registered, and there is no UMA ID yet.
        // Time out after 2s to prevent getting stuck in case something goes wrong during registration.
        const timeoutPromise = promises.setTimeout(2000, '').then(() => {
          throw new InternalServerError(`Unable to finish registration for ${target.path}.`)
        });
        await Promise.race([timeoutPromise, once(this.registerEmitter, target.path)]);
        umaId = await this.umaIdStore.get(target.path);
      }
      if (!umaId) {
        // Somehow, this resource was not registered yet while it does exist.
        // This can be a consequence of adding resources in the wrong way (e.g., copying files),
        // or other special resources, such as derived resources.
        if (await this.resourceSet.hasResource(target)) {
          await this.registerResource(target, issuer);
          umaId = await this.umaIdStore.get(target.path);
        } else {
          throw new NotFoundHttpError();
        }
      }
      // If at this point, there is still no registered ID, there is probably an issue with the resource.
      if (!umaId) {
        throw new InternalServerError(`Unable to request ticket: no UMA ID found for ${target.path}`);
      }
      body.push({
        resource_id: umaId,
        resource_scopes: Array.from(modes).map(mode => `urn:example:css:modes:${mode}`)
      });
    }

    const response = await this.fetcher.fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.status === 200) return undefined;

    if (response.status !== 201) {
      throw new Error(`Error while retrieving UMA Ticket: Received status ${response.status} from '${endpoint}'.`);
    }

    const json = await response.json();

    if (!json.ticket || !isString(json.ticket)) {
      throw new Error('Invalid response from UMA AS: missing or invalid \'ticket\'.');
    }

    return json.ticket;
  }

  private async verifyTokenData(token: string, issuer: string, jwks: string): Promise<UmaClaims> {
    const jwkSet = await createRemoteJWKSet(new URL(jwks));

    const { payload } = await jwtVerify(token, jwkSet, {
      ...this.options,
      issuer: issuer,
      audience: 'solid',
    });

    if (!('permissions' in payload)) return payload;

    for (const permission of Array.isArray(payload.permissions) ? payload.permissions : []) {
      if (!(
        'resource_id' in permission &&
        typeof permission.resource_id === 'string' &&
        'resource_scopes' in permission &&
        Array.isArray(permission.resource_scopes) &&
        permission.resource_scopes.every((scope: unknown) => isString(scope))
      )) {
        throw new Error(`Invalid RPT: 'permissions' array invalid.`);
      }
    }

    return payload;
  }

  /**
   * Validates & parses JWT access token
   * @param token - the JWT access token
   * @param validIssuers - issuers that are allowed to issue a token
   */
  public async verifyJwtToken(token: string, validIssuers: string[]): Promise<UmaClaims> {
    let config: UmaConfig;

    try {
      const issuer = decodeJwt(token).iss;
      if (!issuer) throw new Error('The JWT does not contain an "iss" parameter.');
      if (!validIssuers.includes(issuer))
        throw new Error(`The JWT wasn't issued by one of the target owners' issuers.`);
      config = await this.fetchUmaConfig(issuer);
    } catch (error: unknown) {
      const message = `Error verifying UMA access token: ${(error as Error).message}`;
      this.logger.warn(message);
      throw new Error(message);
    }

    return await this.verifyTokenData(token, config.issuer, config.jwks_uri);
  }

  /**
   * Validates & parses access token
   * @param {string} token - the access token
   * @param {string} issuer - the token issuer
   */
  public async verifyOpaqueToken(token: string, issuer: string): Promise<UmaClaims> {
    const config = await this.fetchUmaConfig(issuer);

    const res = await this.fetcher.fetch(config.introspection_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: `token_type_hint=access_token&token=${token}`,
    });

    if (res.status >= 400) {
      throw new Error(`Unable to introspect UMA RPT for Authorization Server '${config.issuer}'`);
    }

    const jwt = await res.json();
    if (jwt.active !== 'true') throw new Error(`The provided UMA RPT is not active.`);

    return await this.verifyTokenData(jwt, config.issuer, config.jwks_uri);
  }

  /**
   * Fetch UMA Configuration of AS
   * @param {string} issuer - Base URL of the UMA AS
   * @return {Promise<UmaConfig>} - UMA Configuration
   */
  public async fetchUmaConfig(issuer: string): Promise<UmaConfig> {
    const configUrl = issuer + UMA_DISCOVERY;
    const res = await this.fetcher.fetch(configUrl);

    if (res.status >= 400) {
      throw new Error(`Unable to retrieve UMA Configuration for Authorization Server '${issuer}' from '${configUrl}'`);
    }

    const configuration = await res.json();

    const missing = REQUIRED_METADATA.filter((value) => !(value in configuration));
    if (missing.length !== 0) {
      throw new Error(`The Authorization Server Metadata of '${issuer}' is missing attributes ${missing.join(', ')}`);
    }

    const noString = REQUIRED_METADATA.filter((value) => !isString(configuration[value]));
    if (noString.length !== 0) throw new Error(
      `The Authorization Server Metadata of '${issuer}' should have string attributes ${noString.join(', ')}`
    );

    return configuration;
  }

  /**
   * Updates the UMA registration for the given resource on the given issuer.
   * This either registers a new UMA identifier or updates an existing one,
   * depending on if it already exists.
   * For containers, the resource_defaults will be registered,
   * for all resources, the resource_relations with the parent container will be registered.
   * For the latter, it is possible that the parent container is not registered yet,
   * for example, in the case of seeding multiple resources simultaneously.
   * In that case the registration will be done immediately,
   * and updated with the relations once the parent registration is finished.
   */
  public async registerResource(resource: ResourceIdentifier, issuer: string): Promise<void> {
    if (this.inProgressResources.has(resource.path)) {
      // It is possible a resource is still being registered when an updated registration is already requested.
      // To prevent duplicate registrations of the same resource,
      // the next call will only happen when the first one is finished.
      await once(this.registerEmitter, resource.path);
      return this.registerResource(resource, issuer);
    }
    this.inProgressResources.add(resource.path);
    let { resource_registration_endpoint: endpoint } = await this.fetchUmaConfig(issuer);
    const knownUmaId = await this.umaIdStore.get(resource.path);
    if (knownUmaId) {
      endpoint = joinUrl(endpoint, encodeURIComponent(knownUmaId));
    }

    const description: ResourceDescription = {
      name: resource.path,
      resource_scopes: [
        'urn:example:css:modes:read',
        'urn:example:css:modes:append',
        'urn:example:css:modes:create',
        'urn:example:css:modes:delete',
        'urn:example:css:modes:write',
      ],
    };

    if (isContainerIdentifier(resource)) {
      description.resource_defaults = { 'http://www.w3.org/ns/ldp#contains': description.resource_scopes };
    }

    // This function can potentially cause multiple asynchronous calls to be required.
    // These will be stored in this array so they can be executed simultaneously.
    const promises: Promise<void>[] = [];
    if (!this.identifierStrategy.isRootContainer(resource)) {
      const parentIdentifier = this.identifierStrategy.getParentContainer(resource);
      const parentId = await this.umaIdStore.get(parentIdentifier.path);
      if (parentId) {
        description.resource_relations = { '@reverse': { 'http://www.w3.org/ns/ldp#contains': [ parentId ] } };
      } else {
        this.logger.warn(`Unable to register parent relationship of ${
          resource.path} due to missing parent ID. Waiting for parent registration.`);

        promises.push(
          once(this.registerEmitter, parentIdentifier.path)
            .then(() => this.registerResource(resource, issuer)),
        );
        // It is possible the parent is not yet being registered.
        // We need to force a registration in such a case, otherwise the above event will never be fired.
        if (!this.inProgressResources.has(parentIdentifier.path)) {
          promises.push(this.registerResource(parentIdentifier, issuer));
        }
      }
    }

    this.logger.info(
      `${knownUmaId ? 'Updating' : 'Creating'} resource registration for <${resource.path}> at <${endpoint}>`,
    );

    const request: RequestInit = {
      method: knownUmaId ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(description),
    };

    const fetchPromise = this.fetcher.fetch(endpoint, request).then(async resp => {
      if (knownUmaId) {
        if (resp.status !== 200) {
          throw new InternalServerError(`Resource update request failed. ${await resp.text()}`);
        }
      } else {
        if (resp.status !== 201) {
          throw new InternalServerError(`Resource registration request failed. ${await resp.text()}`);
        }

        const { _id: umaId } = await resp.json();

        if (!isString(umaId)) {
          throw new InternalServerError('Unexpected response from UMA server; no UMA id received.');
        }

        await this.umaIdStore.set(resource.path, umaId);
        this.logger.info(`Registered resource ${resource.path} with UMA ID ${umaId}`);
      }
      // Indicate this resource finished registration
      this.inProgressResources.delete(resource.path);
      this.registerEmitter.emit(resource.path);
    });

    // Execute all the required promises.
    promises.push(fetchPromise);
    await Promise.all(promises);
  }

  /**
   * Deletes the UMA registration for the given resource from the given issuer.
   */
  public async deleteResource(resource: ResourceIdentifier, issuer: string): Promise<void> {
    const { resource_registration_endpoint: endpoint } = await this.fetchUmaConfig(issuer);

    const umaId = await this.umaIdStore.get(resource.path);
    if (!umaId) {
      throw new Error(`Trying to remove UMA registration that is not known: ${resource.path}`);
    }
    const url = joinUrl(endpoint, umaId);

    this.logger.info(`Deleting resource registration for <${resource.path}> at <${url}>`);

    await this.fetcher.fetch(url, { method: 'DELETE' });
  }
}

function isString(value: any): value is string {
  return typeof value === 'string' || value instanceof String;
}
