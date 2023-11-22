import {Principal} from '../models/AccessToken';

export interface ClaimTokenRequest {
    /**
     * URL of the token request
     */
    url: URL,
    /**
     * Method of the token request
     */
    method: 'CONNECT' | 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT' | 'TRACE',
    /**
     * Claim Token provided by RP
     */
    claim_token: string | undefined,
    /**
     * Format of the provided Claim Token
     */
    claim_token_format: string | undefined,
    /**
     * A existing requesting party token that can be used in upgrading
     */
    rpt?: string,
    /**
     * A DPoP that is presented by the client and bound to the claim token
     * and/or RPT
     */
    dpop?: string
}
/**
 * A claim token processor authenticates a request, extracting claims from an
 * optional RPT, and returns a Principal.
 */
export abstract class ClaimTokenProcessor {
    public abstract claimTokenFormat(): string;
    public abstract process(req: ClaimTokenRequest): Promise<Principal>;
}
