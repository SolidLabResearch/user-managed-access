import { AccessMap, Logger } from "@solid/community-server";
import { fetchUmaConfig } from "./util/UmaConfigFetcher.js";
import { fetchPermissionTicket } from "./util/PermissionTicketFetcher.js";
import { JWTPayload, decodeJwt } from "jose";
import { UmaVerificationOptions, verifyUmaJwtToken, verifyUmaOpaqueToken } from "./util/UmaTokenVerifier.js";

export type Claims = {
  [key: string]: unknown;
}

export type Introspected<T extends Claims> = Partial<T> & {
  active: boolean,
  token_type?: string,
  username?: string,
}

export type UmaPermission = {
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
  jwks: any;
  issuer: string;
  permission_endpoint: string;
  introspection_endpoint: string;
  resource_registration_endpoint: string;
}

export type PermissionTicketRequest = {
  ticketSubject: string,
  owner: string,
  ticketNeeds: Set<string>
}

/**
 * Client interface for the UMA AS
 */
export abstract class UmaClient {
  protected abstract readonly logger: Logger;
  protected abstract options: UmaVerificationOptions;
  protected abstract retrievePat(issuer: string, owner: string): Promise<string>;
    
  /**
   * Method to fetch a ticket from the Permission Registration endpoint of the UMA Authorization Service.
   *
   * @param {AccessMap} requestedModes - the access targets and modes for which a ticket is requested
   * @param {string} owner - the resource owner of the requested target resources
   * @param {string} issuer - the issuer from which to request the permission ticket
   * @return {Promise<string>} - the permission ticket
   */
  public async fetchTicket(requestedModes: AccessMap, owner: string, issuer: string): Promise<string> {
    const pat = await this.retrievePat(issuer, owner);

    try {
      const permissionEndpoint = (await fetchUmaConfig(issuer)).permission_endpoint;
      return await fetchPermissionTicket(requestedModes, permissionEndpoint, pat);
    } catch (e: any) {
      throw new Error(`Error while retrieving ticket: ${(e as Error).message}`);
    }
  }

  /**
   * Validates & parses JWT access token
   * @param {string} token - the JWT access token
   * @return {UmaToken}
   */
  public async verifyJwtToken(token: string, validIssuers: string[]): Promise<UmaClaims> {
    try {
      const issuer = decodeJwt(token).iss;
      if (!issuer) throw new Error('The JWT does not contain an "iss" parameter.');
      if (!validIssuers.includes(issuer)) throw new Error(`The JWT wasn't issued by one of the target owners' issuers.`);
      const umaConfig = await this.fetchUmaConfig(issuer);
      return await verifyUmaJwtToken(token, umaConfig, this.options);
    } catch (error: unknown) {
      const message = `Error verifying UMA access token: ${(error as Error).message}`;
      this.logger.warn(message);
      throw new Error(message);
    }
  }

  /**
   * Validates & parses JWT access token
   * @param {string} token - the JWT access token
   * @return {UmaToken}
   */
  public async verifyOpaqueToken(token: string, issuer: string, owner: string): Promise<UmaClaims> {
    try {
      const umaConfig = await this.fetchUmaConfig(issuer);
      const pat = await this.retrievePat(owner, issuer)
      return await verifyUmaOpaqueToken(token, umaConfig, pat, this.options);
    } catch (error: unknown) {
      const message = `Error verifying UMA access token: ${(error as Error).message}`;
      this.logger.warn(message);
      throw new Error(message);
    }
  }

  /**
   * Fetch UMA Configuration of AS
   * @param {string} issuer - Base URL of the UMA AS
   * @return {Promise<UmaConfig>} - UMA Configuration
   */
  protected async fetchUmaConfig(issuer: string): Promise<UmaConfig> {
    return await fetchUmaConfig(issuer);
  }
}
