import { ClaimSet } from '../../../../src/credentials/ClaimSet';
import { TypedVerifier } from '../../../../src/credentials/verify/TypedVerifier';
import { Verifier } from '../../../../src/credentials/verify/Verifier';

describe('TypedVerifier', (): void => {
  const claims: ClaimSet[] = [
    { key: 'value1' },
    { key: 'value2' },
  ]
  let verifiers: Record<string, Verifier>;
  let verifier: TypedVerifier;

  beforeEach(async(): Promise<void> => {
    verifiers = {
      'type1': { verify: vi.fn().mockResolvedValue(claims[0]) },
      'type2': { verify: vi.fn().mockResolvedValue(claims[1]) },
    };

    verifier = new TypedVerifier(verifiers);
  });

  it('calls the matching verifier.', async(): Promise<void> => {
    await expect(verifier.verify({ format: 'type2', token: 'token' })).resolves.toEqual(claims[1]);
    expect(verifiers['type1'].verify).toHaveBeenCalledTimes(0);
    expect(verifiers['type2'].verify).toHaveBeenCalledTimes(1);
    expect(verifiers['type2'].verify).toHaveBeenLastCalledWith({ format: 'type2', token: 'token' });
  });

  it('errors if there is no matching verifier.', async(): Promise<void> => {
    await expect(verifier.verify({ format: 'wrong', token: 'token' })).rejects
      .toThrow('The provided "claim_token_format" is not supported.');
    expect(verifiers['type1'].verify).toHaveBeenCalledTimes(0);
    expect(verifiers['type2'].verify).toHaveBeenCalledTimes(0);
  });
});
