import {ForbiddenHttpError} from '../util/http/errors/ForbiddenHttpError';

/**
 * The client is not authorized to have these permissions. The authorization
 * server responds with the HTTP 403 (Forbidden) status code.
 */
export class RequestDeniedError extends ForbiddenHttpError {
  public type: string = 'request_denied';
  /**
     * InvalidGrant UMA Error
     * @param {string} message
     */
  public constructor(message: string) {
    super(message);
  }
}
