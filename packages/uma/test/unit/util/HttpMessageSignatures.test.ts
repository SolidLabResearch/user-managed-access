import { AlgJwk, UnauthorizedHttpError } from '@solid/community-server';
import { httpbis } from 'http-message-signatures';
import { exportJWK, generateKeyPair, GenerateKeyPairResult } from 'jose';
import crypto from 'node:crypto';
import { beforeAll, Mock } from 'vitest';
import { HttpHandlerRequest } from '../../../src/util/http/models/HttpHandler';
import { extractRequestSigner, signRequest, verifyRequest } from '../../../src/util/HttpMessageSignatures';

vi.mock('get-jwks');

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

  describe('#extractRequestSigner', (): void => {
    it('extracts the request signer.', async(): Promise<void> => {
      const request: HttpHandlerRequest = {
        url: new URL('https://example.com/foo'),
        method: 'GET',
        headers: { accept: 'text/turtle', authorization: 'HttpSig cred="https://example.com/bar"' },
      };
      await expect(extractRequestSigner(request)).resolves.toBe('"https://example.com/bar"');
    });

    it('errors if there is no authorization header.', async(): Promise<void> => {
      const request: HttpHandlerRequest = {
        url: new URL('https://example.com/foo'),
        method: 'GET',
        headers: { accept: 'text/turtle' },
      };
      await expect(extractRequestSigner(request)).rejects.toThrow(UnauthorizedHttpError);
    });

    it('errors if the credentials are missing.', async(): Promise<void> => {
      const request: HttpHandlerRequest = {
        url: new URL('https://example.com/foo'),
        method: 'GET',
        headers: { accept: 'text/turtle', authorization: 'HttpSig' },
      };
      await expect(extractRequestSigner(request)).rejects.toThrow(UnauthorizedHttpError);
    });
  });

  describe('#verifyRequest', (): void => {
    let getJwk: Mock<() => unknown>;
    beforeEach(async(): Promise<void> => {
      const getJwks = await import('get-jwks');
      getJwk = vi.fn().mockResolvedValue(publicKey);
      (getJwks.default as unknown as Mock).mockReturnValue({ getJwk } as any);
    });

    it('verifies the request.', async(): Promise<void> => {
      const request = { method: 'GET', headers: { accept: 'text/plain' }, body: 'text' };
      const signedRequest = await signRequest(url, request, privateKey);
      await expect(verifyRequest(signedRequest as any, 'signer')).resolves.toBe(true);
      expect(getJwk).toHaveBeenCalledTimes(1);
      expect(getJwk).toHaveBeenLastCalledWith({ domain: 'signer', alg: 'ES256', kid: 'private' });
    });

    it('returns false if the request could not be verified.', async(): Promise<void> => {
      const request = { method: 'GET', headers: { accept: 'text/plain' }, body: 'text' };
      const signedRequest = await signRequest(url, request, privateKey);
      const badRequest = { ...signedRequest, url: 'https://example.com/wrong' };
      await expect(verifyRequest(badRequest as any, 'signer')).resolves.toBe(false);
      expect(getJwk).toHaveBeenCalledTimes(1);
      expect(getJwk).toHaveBeenLastCalledWith({ domain: 'signer', alg: 'ES256', kid: 'private' });
    });
  });
});
