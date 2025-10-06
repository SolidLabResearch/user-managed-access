import { BadRequestHttpError, getLoggerFor } from '@solid/community-server';
import { ClaimSet } from "../ClaimSet";
import { Credential } from "../Credential";
import { Verifier } from "./Verifier";

/**
 * Redirect verification requests to the relevant verifier by matching the credential format
 * to the keys of the internal verifier map.
 * In case the credential format is the meta type, it is assumed the value is a key/value map
 * with keys being credential formats, and values the associated tokens.
 * These results will be merged, if multiple credentials map to the same claim,
 * the result will depend on the execution order.
 */
export class TypedVerifier implements Verifier {
  private readonly logger = getLoggerFor(this);

  constructor(
    protected readonly verifiers: Record<string, Verifier>,
    protected readonly metaType?: string,
  ) {}

  public async verify(credential: Credential): Promise<ClaimSet> {
    // Recursively verify in case of a meta credential token
    if (credential.format === this.metaType) {
      const metaClaims = {};
      const metaToken = JSON.parse(credential.token);
      for (const [ format, token ] of Object.entries(metaToken)) {
        Object.assign(metaClaims, await this.verify({ format, token: token as string }));
      }

      this.logger.info(`Combined verified claims into ${JSON.stringify(metaClaims)}`);

      return metaClaims;
    }

    const verifier = this.verifiers[credential.format];
    this.logger.debug(`Verifying credential with typed verifier ${JSON.stringify(credential)}`);

    if (!verifier) {
      this.logger.warn('The provided "claim_token_format" is not supported.');
      throw new BadRequestHttpError('The provided "claim_token_format" is not supported.');
    }

    return verifier.verify(credential);
  }
}
