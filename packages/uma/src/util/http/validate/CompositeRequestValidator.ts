import { InternalServerError } from '@solid/community-server';
import { RequestValidator, RequestValidatorInput, RequestValidatorOutput } from './RequestValidator';

/**
 * Validates a request against the first validator that accepts it.
 */
export class CompositeRequestValidator extends RequestValidator {
  public constructor(
    protected readonly validators: RequestValidator[],
  ) {
    super();
  }

  public async handle(input: RequestValidatorInput): Promise<RequestValidatorOutput> {
    let lastError: unknown;
    for (const validator of this.validators) {
      try {
        return await validator.handleSafe(input);
      } catch (error: unknown) {
        lastError = error;
      }
    }

    if (lastError) {
      throw lastError;
    }
    throw new InternalServerError('No request validators were configured.');
  }
}
