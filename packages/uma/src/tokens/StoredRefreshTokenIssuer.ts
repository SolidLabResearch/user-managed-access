import { KeyValueStorage } from '@solid/community-server';
import ms, { StringValue } from 'ms';
import { randomUUID } from 'node:crypto';
import { ClaimSet } from '../credentials/ClaimSet';
import { RefreshInformation } from '../credentials/verify/RefreshTokenVerifier';
import { Permission } from '../views/Permission';
import { RefreshTokenIssuer } from './RefreshTokenIssuer';

/**
 * Generates refresh tokens and stores them in a storage.
 * Default expiration time is 7 days.
 */
export class StoredRefreshTokenIssuer implements RefreshTokenIssuer {
  protected readonly refreshExpiration: number;

  public constructor(
    protected readonly refreshStore: KeyValueStorage<string, RefreshInformation>,
    refreshExpiration: string = '7d',
  ) {
    this.refreshExpiration = ms(refreshExpiration as StringValue);
  }

  public async issue(claims: ClaimSet, permissions: Permission[]): Promise<string> {
    const refreshToken = randomUUID();
    // TODO: expired tokens should be removed; can use expiring storage,
    //       or just normal store with timer-based cleanup.
    await this.refreshStore.set(refreshToken, {
      claims,
      permissions,
      expiration: Date.now() + this.refreshExpiration,
    });
    return refreshToken;
  }
}
