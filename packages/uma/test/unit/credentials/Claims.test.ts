import { getOriginalClaimValue, ORIGINAL, WEBID } from '../../../src/credentials/Claims';

describe('Claims', (): void => {
  describe('#getOriginalClaimValue', (): void => {
    it('prefers original claim values when present.', async(): Promise<void> => {
      expect(getOriginalClaimValue({
        [WEBID]: 'http://example.com/id/user',
        [ORIGINAL]: { [WEBID]: 'user' },
      }, WEBID)).toBe('user');
    });

    it('falls back to top-level claim values.', async(): Promise<void> => {
      expect(getOriginalClaimValue({ [WEBID]: 'http://example.com/id/user' }, WEBID)).toBe('http://example.com/id/user');
    });
  });
});
