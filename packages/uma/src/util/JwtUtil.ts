import { BadRequestHttpError, joinUrl } from '@solid/community-server';
import { createRemoteJWKSet, jwtVerify, JWTVerifyOptions, JWTVerifyResult } from 'jose';

export type JwkSet = ReturnType<typeof createRemoteJWKSet>;

/**
 * Cache for JWKS records.
 */
export const jwksRecord: Record<string, JwkSet> = {};

/**
 * Builds a JWKS for the given issuer URl.
 */
export async function getJwks(issuer: string): Promise<JwkSet> {
  if (jwksRecord[issuer]) {
    return jwksRecord[issuer];
  }
  const configUrl = joinUrl(issuer, '/.well-known/openid-configuration');
  const configResponse = await fetch(configUrl);
  if (configResponse.status !== 200) {
    throw new BadRequestHttpError(`Unable to access ${configUrl}`);
  }
  const config = await configResponse.json() as { jwks_uri?: string, issuer?: string };
  if (config.issuer !== issuer) {
    throw new BadRequestHttpError(`Issuer mismatch: expected ${issuer}, got ${config.issuer}`);
  }
  if (!config.jwks_uri) {
    throw new BadRequestHttpError(`Missing jwks_uri from ${configUrl}`);
  }
  jwksRecord[issuer] = createRemoteJWKSet(new URL(config.jwks_uri));
  return jwksRecord[issuer];
}
