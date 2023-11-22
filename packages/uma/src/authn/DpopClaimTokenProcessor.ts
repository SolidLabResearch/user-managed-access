import {ClaimTokenProcessor, ClaimTokenRequest} from './ClaimTokenProcessor';
import {createSolidTokenVerifier} from '@solid/access-token-verifier';
import {Principal} from '../models/AccessToken';
import {Logger} from '../logging/Logger';
import {getLoggerFor} from '../logging/LoggerUtils';

const IDTOKEN_FORMAT = 'http://openid.net/specs/openid-connect-core-1_0.html#IDToken';

/**
 * Claim Token Processor performing Solid OIDC authentication
 * with DPoP to obtain an authenticated Principal object.
 */
export class DpopClaimTokenProcessor extends ClaimTokenProcessor {
  protected readonly logger: Logger = getLoggerFor(this);

  private readonly verify = createSolidTokenVerifier();

  /**
   * Get the URI of the supported claim token format
   * @return {string}
   */
  public claimTokenFormat(): string {
    return IDTOKEN_FORMAT;
  }
  /**
     * Processes the claim token request, in the process performing Solid OIDC
     * authentication.
     *
     * @param {ClaimTokenRequest} req - request
     * @return {Promise<Principal | undefined>} - returns a Principal if authentication was succesfull,
     *                                            undefined if the token format is unsupported
     */
  public async process(req: ClaimTokenRequest): Promise<Principal> {
    if (req.claim_token_format !== IDTOKEN_FORMAT) {
      throw new Error(`Token format ${req.claim_token_format} does not match this processor's format.`);
    }

    if (!req.dpop) {
      const msg = 'DPoP Header is missing.';
      this.logger.debug(msg);
      throw new Error(msg);
    }

    try {
      const {client_id: clientId, webid: webId} = await this.verify(
          `DPoP ${req.claim_token}`,
          {
            header: req.dpop!,
            method: req.method,
            url: req.url.toString(),
          },
      );
      this.logger.info(`Authenticated as ${webId} via a Solid OIDC.`);
      return {webId, clientId};
    } catch (error: unknown) {
      const message = `Error verifying Access Token via WebID: ${(error as Error).message}`;
      this.logger.debug(message);
      throw new Error(message);
    }
  }
}
