import {HttpHandlerContext} from '../http/models/HttpHandlerContext';

export interface TokenResponse {
    access_token: string,
    refresh_token?: string,
    id_token?: string,
    token_type: string,
    expires_in?: number,
    upgraded?: boolean,
  }

/**
 * A GrantTypeProcessor processes the token request
 * for a specific grant type.
 */
export abstract class GrantTypeProcessor {
    public abstract getSupportedGrantType(): string;
    public abstract process(body: Map<string, string>, context: HttpHandlerContext): Promise<TokenResponse>;
}
