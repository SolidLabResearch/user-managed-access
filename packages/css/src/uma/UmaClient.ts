import { type KeyValueStorage, type ResourceIdentifier, AccessMap, getLoggerFor } from "@solid/community-server";
import type { Fetcher } from "../util/fetch/Fetcher";
import type { ResourceDescription } from '@solidlab/uma';
import { JWTPayload, decodeJwt, createRemoteJWKSet, jwtVerify, JWTVerifyOptions } from "jose";

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

const algMap = {
  'ES256': { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' },
  'ES384': { name: 'ECDSA', namedCurve: 'P-384', hash: 'SHA-384' },
  'ES512': { name: 'ECDSA', namedCurve: 'P-512', hash: 'SHA-512' },
  'HS256': { name: 'HMAC', hash: 'SHA-256' },
  'HS384': { name: 'HMAC', hash: 'SHA-384' },
  'HS512': { name: 'HMAC', hash: 'SHA-512' },
  'PS256': { name: 'RSASSA-PSS', hash: 'SHA-256' },
  'PS384': { name: 'RSASSA-PSS', hash: 'SHA-384' },
  'PS512': { name: 'RSASSA-PSS', hash: 'SHA-512' },
  'RS256': { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
  'RS384': { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' },
  'RS512': { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
}

/**
 * Client interface for the UMA AS
 */
export class UmaClient {
  protected readonly logger = getLoggerFor(this);

  /**
   * @param {UmaVerificationOptions} options - options for JWT verification
   */
  constructor(
    protected umaIdStore: KeyValueStorage<string, string>,
    protected fetcher: Fetcher,
    protected options: UmaVerificationOptions = {},
  ) {}

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
      // const umaId = await this.umaIdStore.get(target.path);
      // if (!umaId) throw new NotFoundHttpError();
      body.push({
        resource_id: target.path, // TODO: map to umaId ? (but raises problems on creation, discovery ...)
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
   * @param {string} token - the JWT access token
   * @return {UmaToken}
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
   * Validates & parses JWT access token
   * @param {string} token - the JWT access token
   * @return {UmaToken}
   */
  public async verifyOpaqueToken(token: string, issuer: string): Promise<UmaClaims> {
    let config: UmaConfig;
    
    try {
      config = await this.fetchUmaConfig(issuer);
    } catch (error: unknown) {
      const message = `Error verifying UMA access token: ${(error as Error).message}`;
      this.logger.warn(message);
      throw new Error(message);
    }

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
    if (!('active' in jwt) || jwt.active !== 'true') throw new Error(`The provided UMA RPT is not active.`);

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

  public async createResource(resource: ResourceIdentifier, issuer: string): Promise<void> {
    const { resource_registration_endpoint: endpoint } = await this.fetchUmaConfig(issuer);

    const description: ResourceDescription = {
      resource_scopes: [
        'urn:example:css:modes:read',
        'urn:example:css:modes:append',
        'urn:example:css:modes:create',
        'urn:example:css:modes:delete',
        'urn:example:css:modes:write',
      ]
    };

    this.logger.info(`Creating resource registration for <${resource.path}> at <${endpoint}>`);

    const request = {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(description),
    };

    // do not await - registration happens in background to cope with errors etc.
    this.fetcher.fetch(endpoint, request).then(async resp => {
      if (resp.status !== 201) {
        throw new Error (`Resource registration request failed. ${await resp.text()}`);
      }

      const { _id: umaId } = await resp.json();
      
      if (!umaId || typeof umaId !== 'string') {
        throw new Error ('Unexpected response from UMA server; no UMA id received.');
      }
      
      this.umaIdStore.set(resource.path, umaId);
    }).catch(error => {
      // TODO: Do something useful on error
      this.logger.warn(
        `Something went wrong during UMA resource registration to create ${resource.path}: ${(error as Error).message}`
      );
    });
  }

  public async deleteResource(resource: ResourceIdentifier, issuer: string): Promise<void> {    
    const { resource_registration_endpoint: endpoint } = await this.fetchUmaConfig(issuer);

    this.logger.info(`Deleting resource registration for <${resource.path}> at <${endpoint}>`);

    const umaId = await this.umaIdStore.get(resource.path);
    const url = `${endpoint}/${umaId}`;

    const request = {
      url,
      method: 'DELETE',
      headers: {}
    };

    // do not await - registration happens in background to cope with errors etc.
    this.fetcher.fetch(endpoint, request).then(async _resp => {
      if (!umaId) throw new Error('Trying to delete unknown/unregistered resource; no UMA id found.');

      await this.fetcher.fetch(url, request);
    }).catch(error => {
      // TODO: Do something useful on error
      this.logger.warn(
        `Something went wrong during UMA resource registration to delete ${resource.path}: ${(error as Error).message}`
      );
    });
  }
}

function isString(value: any): value is string {
  return typeof value === 'string' || value instanceof String;
}
