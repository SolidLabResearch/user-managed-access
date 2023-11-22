import {Logger} from '../logging/Logger';
import {getLoggerFor} from '../logging/LoggerUtils';
import {Principal} from '../models/AccessToken';
import {ClaimTokenProcessor, ClaimTokenRequest} from './ClaimTokenProcessor';

const DUMMY_TOKEN_FORMAT = 'urn:authorization-agent:dummy-token';
/**
 * A dummy claim token processor for debugging purposes
 *
 * **DO NOT USE IN PRODUCTION!**
 */
export class BasicClaimTokenProcessor extends ClaimTokenProcessor {
  protected readonly logger: Logger = getLoggerFor(this);

  /**
   * A dummy claim token processor for debugging purposes
   */
  constructor() {
    super();
    this.logger.warn(`The BasicClaimTokenProcessor was enabled. DO NOT USE THIS IN PRODUCTION!`);
  }

  /**
   * Get the URI of the supported claim token format
   * @return {string}
   */
  public claimTokenFormat(): string {
    return DUMMY_TOKEN_FORMAT;
  }

  /**
     * Process a dummy token of type 'urn:authorization-agent:dummy-token'.
     *
     * @summary The 'urn:authorization-agent:dummy-token' is formatted as '<WebID>(.<ClientID>)?'
     * @param {ClaimTokenRequest} req
     * @return {Promise<Principal | undefined>}
     */
  public async process(req: ClaimTokenRequest): Promise<Principal> {
    if (req.claim_token_format !== DUMMY_TOKEN_FORMAT) {
      throw new Error(`Token format ${req.claim_token_format} does not match this processor's format.`);
    }

    const token = req.claim_token;
    if (!token) throw new Error(`No token provided in request.`);

    const tokenContents = token.split(':');
    try {
      if (tokenContents.length > 2) {
        throw new Error('Invalid token format, only one \':\' is expected.');
      }
      const principal: Principal = {webId: new URL(decodeURIComponent(tokenContents[0])).toString()};

      if (tokenContents.length === 2) {
        principal.clientId = new URL(decodeURIComponent(tokenContents[1])).toString();
      }
      this.logger.info(`Authenticated as ${principal.webId} via a dummy token.`);
      return principal;
    } catch (error: unknown) {
      const message = `Error verifying Access Token via WebID: ${(error as Error).message}`;
      this.logger.debug(message);
      throw new Error(message);
    }
  }
}
