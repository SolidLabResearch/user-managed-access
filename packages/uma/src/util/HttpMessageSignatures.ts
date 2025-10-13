import { UnauthorizedHttpError, type AlgJwk, BadRequestHttpError } from '@solid/community-server';
import { httpbis, type SigningKey, type Request as SignRequest, defaultParams } from 'http-message-signatures';
import { verifyMessage } from 'http-message-signatures/lib/httpbis';
import { type SignatureParameters, type VerifierFinder, type VerifyingKey } from 'http-message-signatures/lib/types';
import { HttpHandlerRequest } from './http/models/HttpHandler';
import buildGetJwks from 'get-jwks';
import crypto from 'node:crypto';

const authParserMod = import('@httpland/authorization-parser');

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

export async function extractRequestSigner(request: HttpHandlerRequest): Promise<string> {
  const { authorization } = request.headers;
  if (!authorization) {
    throw new UnauthorizedHttpError('Missing authorization header in request.');
  }

  const { authScheme, params } = (await authParserMod).parseAuthorization(authorization);
  if (authScheme !== 'HttpSig') {
    throw new UnauthorizedHttpError();
  }

  if (!params || typeof params !== 'object' || !params.cred) {
    throw new UnauthorizedHttpError();
  }

  return params.cred;
}

export async function verifyRequest(
  request: HttpHandlerRequest & SignRequest,
  signer?: string,
): Promise<boolean> {
  signer = signer ?? await extractRequestSigner(request);

  if (signer.startsWith('"')) signer = signer.slice(1);
  if (signer.endsWith('"')) signer = signer.slice(0,-1);

  const jwks = buildGetJwks();

  const keyLookup: VerifierFinder = async (params: SignatureParameters) => {
    const { alg, keyid } = params;

    try {
      const jwk = await jwks.getJwk({
        domain: signer!,
        alg: alg ?? '',
        kid: keyid ?? '',
      });

      if (!alg) throw new BadRequestHttpError('Invalid HTTP message Signature parameters.');

      const verifier: VerifyingKey = {
        id: keyid,
        algs: alg ? [ alg ] : [],
        async verify(data: Buffer, signature: Buffer) {
          try {
            const params = algMap[alg];
            const key = await crypto.subtle.importKey('jwk', jwk, params, false, ['verify']);
            return await crypto.subtle.verify(params, key, signature, data);
          } catch (err) { console.log(err); return null }
        },
      };

      return verifier;

    } catch (err) {
      throw new Error(`Something went wrong during signature checking: ${err.message}`)
    }
  };

  const verified = await verifyMessage({ keyLookup }, request);
  return verified ?? false;
}

type AlgParams = RsaHashedImportParams | EcKeyImportParams | HmacImportParams

const algMap: Record<string, AlgParams> = {
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
