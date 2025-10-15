import { BadRequestHttpError } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { ClaimSet } from '../ClaimSet';
import { Credential } from '../Credential';
import { Verifier } from './Verifier';

export class TypedVerifier implements Verifier {
  private readonly logger = getLoggerFor(this);

  constructor(protected verifiers: Record<string, Verifier>) {}

  public async verify(credential: Credential): Promise<ClaimSet> {
    const verifier = this.verifiers[credential.format];
    this.logger.debug(`Verifying credential with typed verifier ${JSON.stringify(credential)}`);

    if (!verifier) {
      this.logger.warn('The provided "claim_token_format" is not supported.');
      throw new BadRequestHttpError('The provided "claim_token_format" is not supported.');
    }

    return verifier.verify(credential);
  }
}
