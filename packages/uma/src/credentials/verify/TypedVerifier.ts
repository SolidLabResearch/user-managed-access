import { BadRequestHttpError } from "../../util/http/errors/BadRequestHttpError";
import { Logger } from "../../util/logging/Logger";
import { getLoggerFor } from "../../util/logging/LoggerUtils";
import { ClaimSet } from "../ClaimSet";
import { Credential } from "../Credential";
import { Verifier } from "./Verifier";

export class TypedVerifier implements Verifier {
  private readonly logger: Logger = getLoggerFor(this);

  constructor(protected verifiers: Record<string, Verifier>) {}

  public async verify(credential: Credential): Promise<ClaimSet> {
    const verifier = this.verifiers[credential.format];
    
    if (!verifier) {
      this.logger.warn('The provided "claim_token_format" is not supported.');
      throw new BadRequestHttpError('The provided "claim_token_format" is not supported.');
    }

    return verifier.verify(credential);
  }
}