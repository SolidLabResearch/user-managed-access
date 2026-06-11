import { JWK, calculateJwkThumbprint } from 'jose';

export async function ensureJwkKid<T extends JWK>(key: T): Promise<T & { kid: string }> {
  return {
    ...key,
    kid: key.kid ?? await calculateJwkThumbprint(key),
  };
}
