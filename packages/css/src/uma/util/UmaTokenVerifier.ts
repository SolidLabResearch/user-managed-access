import { UmaClaims, UmaConfig } from '../UmaClient';
import * as jose from 'jose';
import { JWTVerifyOptions } from 'jose';
import { isString } from '../../util/StringGuard';

export type UmaVerificationOptions = Omit<JWTVerifyOptions, 'iss' | 'aud' | 'sub' | 'iat'>;

/**
   * Validates & parses an opaque access token
   * @param {string} token - the relying party token
   * @param {UmaConfig} config - configuration of the UMA AS
   * @param {string} pat - the AS PAT
   * @param {JWTVerifyOptions} options - options for verification
   * @return {UmaClaims}
   */
export async function verifyUmaOpaqueToken(
  token: string, 
  config: UmaConfig, 
  pat: string,
  options: UmaVerificationOptions = {},
): Promise<UmaClaims> {
  const request = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: `token_type_hint=access_token&token=${token}`,
  };

  const res = await fetch(config.introspection_endpoint, request);
  if (res.status >= 400) {
    throw new Error(`Unable to introspect UMA RPT for Authorization Server '${config.issuer}'`);
  }

  const jwt = await res.json();
  if (!('active' in jwt) || jwt.active !== 'true') throw new Error(`The provided UMA RPT is not active.`);

  return verifyUmaJwtToken(jwt, config, options);
}


/**
   * Validates & parses a JWT access token
   * @param {string} token - access token
   * @param {UmaConfig} config - configuration of the UMA AS
   * @param {JWTVerifyOptions} options - options for verification
   * @return {UmaClaims}
   */
export async function verifyUmaJwtToken(
  token: string, 
  config: UmaConfig, 
  options: UmaVerificationOptions = {},
): Promise<UmaClaims> {
  const { payload } = await jose.jwtVerify(token, config.jwks, {
    ...options,
    issuer: config.issuer,
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
