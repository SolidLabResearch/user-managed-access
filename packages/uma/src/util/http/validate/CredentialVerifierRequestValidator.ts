import { UnauthorizedHttpError } from '@solid/community-server';
import { WEBID } from '../../../credentials/Claims';
import { CredentialParser } from '../../../credentials/CredentialParser';
import { Verifier } from '../../../credentials/verify/Verifier';
import { RequestValidator, RequestValidatorInput, RequestValidatorOutput } from './RequestValidator';

/**
 * Validates requests by verifying the Credential and extracting the owner.
 */
export class CredentialVerifierRequestValidator extends RequestValidator {
  public constructor(
    protected readonly credentialParser: CredentialParser,
    protected readonly verifier: Verifier,
  ) {
    super();
  }

  public async canHandle({ request }: RequestValidatorInput): Promise<void> {
    await this.credentialParser.canHandle(request);
  }

  public async handle({ request }: RequestValidatorInput): Promise<RequestValidatorOutput> {
    const result = await this.credentialParser.handle(request);
    const claims = await this.verifier.verify(result);
    if (!claims[WEBID] || claims[WEBID].length === 0) {
      throw new UnauthorizedHttpError('Could not determine owner.');
    }
    return { owner: claims[WEBID][0] as string};
  }
}
