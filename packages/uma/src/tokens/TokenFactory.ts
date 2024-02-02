import {AccessToken} from './AccessToken';

export interface SerializedToken {
  tokenType: string,
  token: string
}

/**
 * A TokenFactory is responsible for generating UMA Access
 * Tokens that can be used by a client as well as for validating
 * and deserializing gathered tokens
 */
export abstract class TokenFactory {
  public abstract serialize(token: AccessToken): Promise<SerializedToken>;
  public abstract deserialize(token: string): Promise<AccessToken>;
}
