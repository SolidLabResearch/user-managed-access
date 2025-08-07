import type { JwkGenerator } from '@solid/community-server';
import { httpbis, SignConfig } from 'http-message-signatures';
import { Mocked } from 'vitest';
import { Fetcher } from '../../../../src/util/fetch/Fetcher';
import { SignedFetcher } from '../../../../src/util/fetch/SignedFetcher';

vi.mock('http-message-signatures', () => ({
  httpbis: { signMessage: vi.fn() }
}));

vi.mock('node:crypto', () => ({
  webcrypto: {},
}));

describe('SignedFetcher', (): void => {
  const baseUrl = 'http://example.com';
  const jwk = { alg: 'ES256', kid: 'kid' };
  const signedMessage = 'signed';
  const signMessage = vi.mocked(httpbis.signMessage);
  let keyGen: Mocked<JwkGenerator>;
  let source: Mocked<Fetcher>;
  let fetcher: SignedFetcher;

  beforeEach(async(): Promise<void> => {
    signMessage.mockClear();
    signMessage.mockResolvedValue(signedMessage as any);

    keyGen = {
      alg: 'ES256',
      getPrivateKey: vi.fn().mockResolvedValue(jwk),
      getPublicKey: vi.fn(),
    }

    source = {
      fetch: vi.fn().mockResolvedValue('result'),
    };

    fetcher = new SignedFetcher(source, baseUrl, keyGen);
  });

  it('performs the fetch with the signed request.', async(): Promise<void> => {
    await expect(fetcher.fetch('http://example.com', { method: 'DELETE', headers: { accept: 'text/turtle' } })).resolves.toBe('result');
    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(signMessage).toHaveBeenLastCalledWith(
      { key: expect.objectContaining({ alg: 'ES256', id: 'kid' }), paramValues: { keyid: 'TODO' }},
      {
        url: 'http://example.com',
        method: 'DELETE',
        headers: { accept: 'text/turtle', Authorization: 'HttpSig cred="http://example.com"' },
      },
    );
    expect(source.fetch).toHaveBeenCalledTimes(1);
    expect(source.fetch).toHaveBeenLastCalledWith('http://example.com', 'signed');

    // Testing the internal sign function
    const importKeyMock = vitest.spyOn(crypto.subtle, 'importKey').mockResolvedValueOnce('key!' as any);
    const signMock = vitest.spyOn(crypto.subtle, 'sign').mockResolvedValueOnce('signed!' as any);
    const params = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' };

    const sign = (signMessage.mock.calls[0][0] as SignConfig).key.sign;
    const data = Buffer.from('data');
    await expect(sign(data)).resolves.toEqual(Buffer.from('signed!'));
    expect(importKeyMock).toHaveBeenCalledTimes(1);
    expect(importKeyMock)
      .toHaveBeenLastCalledWith('jwk', jwk, params, false, ['sign']);
    expect(signMock).toHaveBeenCalledTimes(1);
    expect(signMock).toHaveBeenLastCalledWith(params, 'key!', data);
  });
});
