import { getLoggerFor } from '@solid/community-server';
import { UmaClient } from './UmaClient';
import { UmaVerificationOptions } from './util/UmaTokenVerifier';

/**
 * A UmaClient provides an API for using the features of a UMA Authorization Service.
 */
export class UmaClientImpl extends UmaClient {
  protected readonly logger = getLoggerFor(this);

  /**
   * @param {string} pat - the static AS PAT
   * @param {UmaVerificationOptions} options - options for JWT verification
   */
  constructor(
    private pat: string, 
    protected options: UmaVerificationOptions = {},
  ) {
    super();
  }

  protected async retrievePat(): Promise<string> {
    return this.pat;
  }
}
