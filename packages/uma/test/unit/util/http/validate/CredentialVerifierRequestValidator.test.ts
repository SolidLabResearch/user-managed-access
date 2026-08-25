import { BadRequestHttpError } from '@solid/community-server';
import { Mocked } from 'vitest';
import { WEBID } from '../../../../../src/credentials/Claims';
import { ClaimSet } from '../../../../../src/credentials/ClaimSet';
import { CredentialParser } from '../../../../../src/credentials/CredentialParser';
import { Verifier } from '../../../../../src/credentials/verify/Verifier';
import {
  CredentialVerifierRequestValidator
} from '../../../../../src/util/http/validate/CredentialVerifierRequestValidator';
import { RequestValidatorInput } from '../../../../../src/util/http/validate/RequestValidator';

describe('CredentialVerifierRequestValidator', (): void => {
  const webid = 'https://example.com/profile/card#me';
  let input: RequestValidatorInput;
  let claims: ClaimSet;
  let tokenResponse: { token: string, format: string };

  let credentialParser: Mocked<CredentialParser>;
  let verifier: Mocked<Verifier>;
  let validator: CredentialVerifierRequestValidator;

  beforeEach(async(): Promise<void> => {
    input = {
      request: {
        url: new URL('http://example.com/foo'),
        method: 'GET',
        headers: { authorization: 'Bearer token' },
      }
    };

    tokenResponse = {
      token: 'token',
      format: 'format',
    };

    claims = {
      [WEBID]: [ webid ],
    };

    credentialParser = {
      canHandle: vi.fn(),
      handle: vi.fn().mockResolvedValue(tokenResponse),
    } satisfies Partial<CredentialParser> as any;

    verifier = {
      verify: vi.fn().mockResolvedValue(claims),
    };

    validator = new CredentialVerifierRequestValidator(credentialParser, verifier);
  });

  it('can handle requests the verifier can handle.', async(): Promise<void> => {
    await expect(validator.canHandle(input)).resolves.toBeUndefined();
    expect(credentialParser.canHandle).toHaveBeenLastCalledWith(input.request);

    credentialParser.canHandle.mockRejectedValueOnce(new BadRequestHttpError('bad data'));
    await expect(validator.canHandle(input)).rejects.toThrow('bad data');
  });

  it('returns the WEBID claim as owner.', async(): Promise<void> => {
    await expect(validator.handle(input)).resolves.toEqual({ owner: webid });
    expect(credentialParser.handle).toHaveBeenLastCalledWith(input.request);
    expect(verifier.verify).toHaveBeenLastCalledWith(tokenResponse);
  });

  it('errors if there is no WEBID claim.', async(): Promise<void> => {
    claims = {};
    verifier.verify.mockResolvedValueOnce(claims);
    await expect(validator.handle(input)).rejects.toThrow('Could not determine owner.');
  });
});
