import { AccessMap, getLoggerFor, InternalServerError, JwkGenerator } from "@solid/community-server";
import { JWTPayload, decodeJwt, createRemoteJWKSet, jwtVerify, JWTVerifyOptions } from "jose";
import { httpbis, type SigningKey, type Request as SignRequest } from 'http-message-signatures';
import { isString } from '../util/StringGuard';
import fetch from 'cross-fetch';
import type { Fetcher } from "../util/fetch/Fetcher";
import crypto from 'node:crypto';

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
   * @param {JwkGenerator} keyGen - the generator providing the signing key
   * @param {UmaVerificationOptions} options - options for JWT verification
   */
  constructor(
    protected baseUrl: string,
    protected keyGen: JwkGenerator, 
    protected fetcher: Fetcher,
    protected options: UmaVerificationOptions = {},
  ) {}

  public async signedFetch(url: string, request: RequestInit & Omit<SignRequest, 'url'>): Promise<Response> {
    const jwk = await this.keyGen.getPrivateKey();

    const { alg, kid } = jwk;
    if (alg === 'EdDSA') throw new InternalServerError('EdDSA signing is not supported');
    if (alg === 'ES256K') throw new InternalServerError('ES256K signing is not supported');

    const key: SigningKey = {
      id: kid,
      alg: alg,
      async sign(data: BufferSource) {
        const params = algMap[alg];
        const key = await crypto.subtle.importKey('jwk', jwk, params, false, ['sign']);
        return Buffer.from(await crypto.subtle.sign(params, key, data));
      },
    };

    request.headers['Authorization'] = `HttpSig cred="${this.baseUrl}"`;

    const signed = await httpbis.signMessage({ key, paramValues: { keyid: 'TODO' } }, { ...request, url });

    return await this.fetcher.fetch(url, signed);
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
      body.push({
        resource_id: target.path,
        resource_scopes: Array.from(modes).map(mode => `urn:example:css:modes:${mode}`)
      });
    }

    const response = await this.signedFetch(endpoint, {
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

    const res = await this.signedFetch(config.introspection_endpoint, {
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
    const res = await fetch(configUrl);

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
}
