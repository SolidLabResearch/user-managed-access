import { ExpiringStorage } from '@solid/community-server';
import { Mocked } from 'vitest';
import { RefreshInformation } from '../../../src/credentials/verify/RefreshTokenVerifier';
import { StoredRefreshTokenIssuer } from '../../../src/tokens/StoredRefreshTokenIssuer';

const now = new Date();
vi.useFakeTimers({ now });

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('refresh-token-id'),
}));

describe('StoredRefreshTokenIssuer', (): void => {
  const claims = { webid: 'https://alice.example/#me' };
  const permissions = [ { resource_id: 'id', resource_scopes: [ 'scope' ] } ];

  let refreshStore: Mocked<ExpiringStorage<string, RefreshInformation>>;
  let issuer: StoredRefreshTokenIssuer;

  beforeEach(async(): Promise<void> => {
    refreshStore = {
      set: vi.fn(),
    } as any;

    issuer = new StoredRefreshTokenIssuer(refreshStore, '7d');
  });

  it('issues a refresh token and stores refresh metadata.', async(): Promise<void> => {
    const result = await issuer.issue(claims, permissions);

    expect(refreshStore.set).toHaveBeenCalledTimes(1);
    expect(refreshStore.set).toHaveBeenLastCalledWith('refresh-token-id', {
      claims,
      permissions,
      expiration: now.getTime() + 7 * 24 * 60 * 60 * 1000,
    }, 7 * 24 * 60 * 60 * 1000);
    expect(result).toBe('refresh-token-id');
  });
});
