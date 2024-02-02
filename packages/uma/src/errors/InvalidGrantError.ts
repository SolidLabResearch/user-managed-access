import {BadRequestHttpError} from '../util/http/errors/BadRequestHttpError';

/**
 * If the provided permission ticket was not found at the authorization server,
 * or the provided permission ticket has expired,  the authorization server responds
 * with the HTTP 400 (Bad Request) status code.
 */
export class InvalidGrantError extends BadRequestHttpError {
  public type: string = 'invalid_grant';
  /**
     * InvalidGrant UMA Error
     * @param {string} message
     */
  public constructor(message: string) {
    super(message);
  }
}
