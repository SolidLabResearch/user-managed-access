import { AlgJwk } from '@solid/community-server';
import { httpbis } from 'http-message-signatures';
import { exportJWK, generateKeyPair, GenerateKeyPairResult } from 'jose';
import crypto from 'node:crypto';
import { beforeAll } from 'vitest';
import { signRequest } from '../../../src/util/HttpMessageSignatures';

describe('HttpMessageSignatures', (): void => {
  const url = 'https://example.com/foo';
  const alg = 'ES256';
  let keys: GenerateKeyPairResult;
  let publicKey: AlgJwk;
  let privateKey: AlgJwk;

  beforeAll(async(): Promise<void> => {
    keys = await generateKeyPair(alg);
    publicKey = { ...await exportJWK(keys.publicKey), alg, kid: 'public' };
    privateKey = { ...await exportJWK(keys.privateKey), alg, kid: 'private' };
  });

  describe('#signRequest', (): void => {
    it('adds the signature headers to the request.', async(): Promise<void> => {
      const request = { method: 'GET', headers: { accept: 'text/plain' }, body: 'text' };
      const signedRequest = await signRequest(url, request, privateKey);
      expect(signedRequest).toMatchObject(request);
      expect(signedRequest.headers['Signature-Input']).includes('sig=("@target-uri" "@method")');
      const verified = await httpbis.verifyMessage({
        keyLookup: async() => ({
          async verify(data: Buffer, signature: Buffer) {
            const params = { name: 'ECDSA', hash: 'SHA-256', namedCurve: 'P-256' };
            const key = await crypto.subtle.importKey('jwk', publicKey, params, false, ['verify']);
            return await crypto.subtle.verify(params, key, signature, data);
          },
        })},
        signedRequest,
      );
      expect(verified).toBe(true);
    });
  });
});
