import { KeyValueStorage, UnauthorizedHttpError } from '@solid/community-server';
import { PatEntry } from '../../../routes/Pat';
import { RequestValidator, RequestValidatorInput, RequestValidatorOutput } from './RequestValidator';

/**
 * Validates requests by verifying if the PAT is registered.
 */
export class PatRequestValidator extends RequestValidator {
  public constructor(
    protected readonly storage: KeyValueStorage<string, PatEntry>,
  ) {
    super();
  }

  public async handle({ request }: RequestValidatorInput): Promise<RequestValidatorOutput> {
    const { authorization } = request.headers;
    if (!authorization || !/^Bearer /ui.test(authorization)) {
      throw new UnauthorizedHttpError('No Bearer Authorization header specified.');
    }

    const token = authorization?.replace(/^Bearer/, '')?.trimStart();
    if (!token) {
      throw new UnauthorizedHttpError('Found empty Bearer token.');
    }

    const patEntry = await this.storage.get(token);
    if (!patEntry) {
      throw new UnauthorizedHttpError('Unknown PAT authorization value.');
    }

    // TODO: how to validate if the the request was sent by the registered RS?

    return { owner: patEntry.owner };
  }
}
