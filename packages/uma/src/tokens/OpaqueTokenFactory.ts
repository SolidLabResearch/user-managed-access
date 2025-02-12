import { KeyValueStorage } from '@solid/community-server';
import {AccessToken} from './AccessToken';
import {SerializedToken, TokenFactory} from './TokenFactory';
import {v4} from 'uuid';

/**
 * A TokenFactory that serializes to an opaque string
 */
export class OpaqueTokenFactory extends TokenFactory {
  /**
   *
   * @param {KeyValueStorage<string, AccessToken>} tokenStore
   */
  constructor(private tokenStore: KeyValueStorage<string, AccessToken>) {
    super();
  }

  /**
   *
   * @param {AccessToken} token
   * @return {Promise<SerializedToken>}
   */
  public async serialize(token: AccessToken): Promise<SerializedToken> {
    const serialized = v4();
    await this.tokenStore.set(serialized, token);
    return {tokenType: 'Bearer', token: serialized};
  }

  /**
   *
   * @param {string} token
   */
  public async deserialize(token: string): Promise<AccessToken> {
    const retrieved = await this.tokenStore.get(token);
    if (retrieved) return retrieved;
    throw new Error('Token string not recognized.');
  }
}
