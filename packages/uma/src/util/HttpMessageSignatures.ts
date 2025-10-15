import { type AlgJwk } from '@solid/community-server';
import { httpbis, type Request as SignRequest, type SigningKey } from 'http-message-signatures';
import crypto, { webcrypto } from 'node:crypto';
import { BufferSource } from 'node:stream/web';

export async function signRequest(
  url: string,
  request: RequestInit & Omit<SignRequest, 'url'>,
  jwk: AlgJwk
): Promise<RequestInit & SignRequest> {
  const key: SigningKey = {
    id: jwk.kid,
    alg: jwk.alg,
    async sign(data: BufferSource) {
      const params = algMap[jwk.alg];
      const key = await crypto.subtle.importKey('jwk', jwk, params, false, ['sign']);
      return Buffer.from(await crypto.subtle.sign(params, key, data));
    },
  };

  return await httpbis.signMessage({ key, fields: [ '@target-uri', '@method' ] }, { ...request, url });
}

type AlgParams = webcrypto.RsaHashedImportParams | webcrypto.EcKeyImportParams | webcrypto.HmacImportParams

export const algMap: Record<string, AlgParams> = {
  'ES256': { name: 'ECDSA', hash: 'SHA-256', namedCurve: 'P-256' },
  'ES384': { name: 'ECDSA', hash: 'SHA-384', namedCurve: 'P-384' },
  'ES512': { name: 'ECDSA', hash: 'SHA-512', namedCurve: 'P-512' },
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
