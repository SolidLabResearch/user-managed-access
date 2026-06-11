import { ForbiddenHttpError } from '@solid/community-server';
import { Mocked } from 'vitest';
import { CompositeRequestValidator } from '../../../../../src/util/http/validate/CompositeRequestValidator';
import { RequestValidator } from '../../../../../src/util/http/validate/RequestValidator';

describe('CompositeRequestValidator', (): void => {
  let first: Mocked<RequestValidator>;
  let second: Mocked<RequestValidator>;
  let validator: CompositeRequestValidator;

  beforeEach(async(): Promise<void> => {
    first = {
      handleSafe: vi.fn().mockResolvedValue({ owner: 'first' }),
    } as any;
    second = {
      handleSafe: vi.fn().mockResolvedValue({ owner: 'second', resourceId: 'id', allowCreate: true }),
    } as any;
    validator = new CompositeRequestValidator([ first, second ]);
  });

  it('returns the first successful validation result.', async(): Promise<void> => {
    await expect(validator.handle({ request: {} as any })).resolves.toEqual({ owner: 'first' });
    expect(first.handleSafe).toHaveBeenCalledTimes(1);
    expect(second.handleSafe).toHaveBeenCalledTimes(0);
  });

  it('falls back to the next validator.', async(): Promise<void> => {
    first.handleSafe.mockRejectedValueOnce(new ForbiddenHttpError('Unknown PAT.'));

    await expect(validator.handle({ request: {} as any })).resolves.toEqual({
      owner: 'second',
      resourceId: 'id',
      allowCreate: true,
    });
    expect(first.handleSafe).toHaveBeenCalledTimes(1);
    expect(second.handleSafe).toHaveBeenCalledTimes(1);
  });

  it('throws the last validation error when none succeed.', async(): Promise<void> => {
    first.handleSafe.mockRejectedValueOnce(new ForbiddenHttpError('Unknown PAT.'));
    second.handleSafe.mockRejectedValueOnce(new ForbiddenHttpError('Bad management token.'));

    await expect(validator.handle({ request: {} as any })).rejects.toThrow('Bad management token.');
  });
});
