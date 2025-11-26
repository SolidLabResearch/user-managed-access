import { Mocked } from 'vitest';
import { CLIENTID, WEBID } from '../../../../src/credentials/Claims';
import { Credential } from '../../../../src/credentials/Credential';
import { IriVerifier } from '../../../../src/credentials/verify/IriVerifier';
import { Verifier } from '../../../../src/credentials/verify/Verifier';

describe('IriVerifier', (): void => {
  const credential: Credential = { token: 'token', format: 'format' };
  const baseUrl = 'http://example.com/id/';
  let source: Mocked<Verifier>;
  let verifier: IriVerifier;

  beforeEach(async(): Promise<void> => {
    source = {
      verify: vi.fn(),
    };

    verifier = new IriVerifier(source, baseUrl);
  });

  it('keeps the original user and client ID if they already are IRIs', async(): Promise<void> => {
    source.verify.mockResolvedValueOnce({
      [WEBID]: 'http://example.org/webId',
      [CLIENTID]: 'http://example.org/clientId',
      fruit: 'apple',
    });
    await expect(verifier.verify(credential)).resolves.toEqual({
      [WEBID]: 'http://example.org/webId',
      [CLIENTID]: 'http://example.org/clientId',
      fruit: 'apple',
    });
    expect(source.verify).toHaveBeenCalledTimes(1);
    expect(source.verify).toHaveBeenLastCalledWith(credential);
  });

  it('changes the user and client ID to IRIs when required.', async(): Promise<void> => {
    source.verify.mockResolvedValueOnce({
      [WEBID]: 'webId',
      [CLIENTID]: 'clientId',
      fruit: 'http://example.org/apple',
    });
    await expect(verifier.verify(credential)).resolves.toEqual({
      [WEBID]: 'http://example.com/id/webId',
      [CLIENTID]: 'http://example.com/id/clientId',
      fruit: 'http://example.org/apple',
    });
    expect(source.verify).toHaveBeenCalledTimes(1);
    expect(source.verify).toHaveBeenLastCalledWith(credential);
  });
});
