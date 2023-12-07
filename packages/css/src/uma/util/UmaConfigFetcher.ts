import { isString } from '../../util/StringGuard';
import { UmaConfig } from '../UmaClient';
import fetch from 'cross-fetch';
import * as jose from 'jose';

export const UMA_DISCOVERY = '/.well-known/uma2-configuration';

const REQUIRED_METADATA = [
  'issuer', 
  'jwks_uri', 
  'permission_endpoint', 
  'introspection_endpoint', 
  'resource_registration_endpoint'
];

/**
   * Fetch UMA Configuration of AS
   * @param {string} issuer - Base URL of the UMA AS
   * @return {Promise<UmaConfig>} - UMA Configuration
   */
export async function fetchUmaConfig(issuer: string): Promise<UmaConfig> {
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

  return { ...configuration, jwks: jose.createRemoteJWKSet(new URL(configuration.jwks_uri)) };
}
