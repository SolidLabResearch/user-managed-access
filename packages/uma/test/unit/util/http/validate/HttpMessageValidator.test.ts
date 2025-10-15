import { AlgJwk, UnauthorizedHttpError } from '@solid/community-server';
import { exportJWK, generateKeyPair, GenerateKeyPairResult } from 'jose';
import { beforeAll, Mock } from 'vitest';
import { HttpHandlerRequest } from '../../../../../src/util/http/models/HttpHandler';
import { HttpMessageValidator } from '../../../../../src/util/http/validate/HttpMessageValidator';
import { signRequest } from '../../../../../src/util/HttpMessageSignatures';

vi.mock('get-jwks');

describe('HttpMessageValidator', (): void => {
  const url = 'https://example.com/foo';
  const alg = 'ES256';
  let keys: GenerateKeyPairResult;
  let publicKey: AlgJwk;
  let privateKey: AlgJwk;
  let getJwk: Mock<() => unknown>;
  let request: HttpHandlerRequest<string>;

  const validator = new HttpMessageValidator();

  beforeAll(async(): Promise<void> => {
    keys = await generateKeyPair(alg);
    publicKey = { ...await exportJWK(keys.publicKey), alg, kid: 'public' };
    privateKey = { ...await exportJWK(keys.privateKey), alg, kid: 'private' };

    const getJwks = await import('get-jwks');
    getJwk = vi.fn().mockResolvedValue(publicKey);
    (getJwks.default as unknown as Mock).mockReturnValue({ getJwk } as any);

    const baseRequest = {
      method: 'POST',
      headers: { authorization: 'HttpSig cred="https://example.com/bar"' },
      body: 'text'
    };
    const signedRequest = await signRequest(url, baseRequest, privateKey);
    request = {
      url: new URL(url),
      method: signedRequest.method,
      headers: signedRequest.headers as any,
      parameters: {},
    }
  });

  it('returns the signer as the owner.', async(): Promise<void> => {
    await expect(validator.handle({ request })).resolves.toEqual({ owner: 'https://example.com/bar' });
    expect(getJwk).toHaveBeenCalledTimes(1);
    expect(getJwk).toHaveBeenLastCalledWith({
      domain: 'https://example.com/bar',
      alg,
      kid: 'private',
    });
  });

  it('errors if the authorization header is missing.', async(): Promise<void> => {
    request.headers = {};
    await expect(validator.handle({ request })).rejects.toThrow('Missing authorization header in request.');
  });

  it('errors if the authorization scheme is not HttpSig.', async(): Promise<void> => {
    request.headers.authorization = 'Basic 123';
    await expect(validator.handle({ request })).rejects.toThrow(UnauthorizedHttpError);
  });

  it('errors if no `cred` parameter could be extracted from the header.', async(): Promise<void> => {
    request.headers.authorization = 'HttpSig pear';
    await expect(validator.handle({ request })).rejects.toThrow(UnauthorizedHttpError);
  });

  it('errors if the signature used a wrong key.', async(): Promise<void> => {
    keys = await generateKeyPair(alg);
    const otherKey = { ...await exportJWK(keys.privateKey), alg, kid: 'private' };
    const baseRequest = {
      method: 'POST',
      headers: { authorization: 'HttpSig cred="https://example.com/bar"' },
      body: 'text'
    };
    const signedRequest = await signRequest(url, baseRequest, otherKey as AlgJwk);
    request = {
      url: new URL(url),
      method: signedRequest.method,
      headers: signedRequest.headers as any,
      parameters: {},
    }
    await expect(validator.handle({ request })).rejects.toThrow('Failed to verify signature');
  });
});
