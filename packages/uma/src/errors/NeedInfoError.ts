import {ForbiddenHttpError} from '../util/http/errors/ForbiddenHttpError';

export type RedirectUserInfo = {
    redirect_user: string
}
export type RequiredClaimsInfo = {
    required_claims: { claim_token_format: string[][] }
}

/**
 * The authorization server needs additional information in order for a request to succeed,
 * for example, a provided claim token was invalid or expired, or had an incorrect format,
 * or additional claims are needed to complete the authorization assessment.
 * The authorization server responds with the HTTP 403 (Forbidden) status code.
 *
 * It MUST include a ticket parameter, and it MUST also include either the required_claims
 * parameter or the redirect_user parameter, or both, as hints about the information it needs.
 */
export class NeedInfoError extends ForbiddenHttpError {
  public type: string = 'request_denied';
  public ticket: string;
  public additionalParams: RedirectUserInfo | RequiredClaimsInfo;
  /**
     * InvalidGrant UMA Error
     * @param {string} message
     * @param {string} ticket
     * @param {RedirectUserInfo|RequiredClaimsInfo} additionalParams
     */
  public constructor(message: string, ticket: string, additionalParams: RedirectUserInfo | RequiredClaimsInfo) {
    super(message);
    this.ticket = ticket;
    this.additionalParams = additionalParams;
  }
}
