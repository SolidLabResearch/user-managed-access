import {HttpHandlerContext} from '../util/http/models/HttpHandlerContext';

export interface TokenResponse {
    access_token: string,
    refresh_token?: string,
    id_token?: string,
    token_type: string,
    expires_in?: number,
    upgraded?: boolean,
  }

/**
 * A GrantProcessor processes the token request
 * for a specific grant type.
 */
export abstract class GrantProcessor {
    public abstract getSupportedGrantType(): string;
    public abstract process(body: Map<string, string>, context: HttpHandlerContext): Promise<TokenResponse>;
}
