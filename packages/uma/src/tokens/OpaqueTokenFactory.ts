import { BadRequestHttpError, KeyValueStorage } from '@solid/community-server';
import { randomUUID } from 'node:crypto';
import { ClaimSet } from '../credentials/ClaimSet';
import {AccessToken} from './AccessToken';
import {SerializedToken, TokenFactory} from './TokenFactory';

/**
 * A TokenFactory that serializes to an opaque string
 */
export class OpaqueTokenFactory extends TokenFactory {
  /**
   *
   * @param {KeyValueStorage<string, AccessToken>} tokenStore
   */
  constructor(protected readonly tokenStore: KeyValueStorage<string, { token: AccessToken, claims?: ClaimSet }>) {
    super();
  }

  public async serialize(token: AccessToken, claims?: ClaimSet): Promise<SerializedToken> {
    const serialized = randomUUID();
    await this.tokenStore.set(serialized, { token, claims });
    return {tokenType: 'Bearer', token: serialized};
  }

  public async deserialize(token: string): Promise<{ token: AccessToken, claims?: ClaimSet }> {
    // TODO: might want to move this behaviour outside of this class as it is the same for all factories
    const result = await this.tokenStore.get(token);
    if (!result) {
      throw new BadRequestHttpError('Invalid Access Token provided');
    }
    return result;
  }
}
