import { InternalServerError, type JwkGenerator } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { httpbis, type SigningKey } from 'http-message-signatures';
import { BufferSource } from 'node:stream/web';
import type { Fetcher, FetchParams } from './Fetcher';

const algMap = {
  'Ed25519': { name: 'Ed25519' },
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
} as const;

/**
 * A {@link Fetcher} wrapper that signes requests.
 */
export class SignedFetcher implements Fetcher {
  protected readonly logger = getLoggerFor(this);

  constructor(
    protected fetcher: Fetcher,
    protected baseUrl: string,
    protected keyGen: JwkGenerator,
  ) {}

  public async fetch(...[ input, init ]: FetchParams): Promise<Response> {
    const jwk = await this.keyGen.getPrivateKey();

    const { alg, kid } = jwk;
    if (alg === 'EdDSA') throw new InternalServerError('EdDSA signing is not supported');
    if (alg === 'ML-DSA-44') throw new InternalServerError('ML-DSA-44 signing is not supported');
    if (alg === 'ML-DSA-65') throw new InternalServerError('ML-DSA-65 signing is not supported');
    if (alg === 'ML-DSA-87') throw new InternalServerError('ML-DSA-87 signing is not supported');

    const key: SigningKey = {
      id: kid,
      alg: alg,
      async sign(data: BufferSource) {
        const params = algMap[alg];
        const key = await crypto.subtle.importKey('jwk', jwk, params, false, ['sign']);
        return Buffer.from(await crypto.subtle.sign(params, key, data));
      },
    };

    const url = input instanceof URL ? input.href : input instanceof Request ? input.url : input as string;

    const request = {
      ...init ?? {},
      url,
      method: init?.method ?? 'GET',
      headers: {} as Record<string, string>,
    };
    new Headers(init?.headers).forEach((value, key) => request.headers[key] = value);
    request.headers['Authorization'] = `HttpSig cred="${this.baseUrl}"`;

    const signed = await httpbis.signMessage({
      key,
      fields: [ '@target-uri', '@method' ],
      paramValues: { keyid: 'TODO' }
    }, request);

    return await this.fetcher.fetch(url, signed);
  }
}
