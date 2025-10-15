import {
  ForbiddenHttpError,
  IndexedStorage,
  InternalServerError,
  UnauthorizedHttpError
} from '@solid/community-server';
import {
  CLIENT_REGISTRATION_STORAGE_DESCRIPTION,
  CLIENT_REGISTRATION_STORAGE_TYPE
} from '../../../routes/ClientRegistration';
import { PAT_STORAGE_DESCRIPTION, PAT_STORAGE_TYPE } from '../../../routes/Token';
import { RequestValidator, RequestValidatorInput, RequestValidatorOutput } from './RequestValidator';

/**
 * Validates requests by verifying if the PAT is registered.
 */
export class PatRequestValidator extends RequestValidator {
  private readonly storage: IndexedStorage<{
    [CLIENT_REGISTRATION_STORAGE_TYPE]: typeof CLIENT_REGISTRATION_STORAGE_DESCRIPTION,
    [PAT_STORAGE_TYPE]: typeof PAT_STORAGE_DESCRIPTION,
  }>;

  public constructor(
    storage: IndexedStorage<Record<string, never>>,
  ) {
    super();
    this.storage = storage;
  }

  public async handle({ request }: RequestValidatorInput): Promise<RequestValidatorOutput> {
    const { authorization } = request.headers;
    if (!authorization || !/^Bearer /ui.test(authorization)) {
      throw new UnauthorizedHttpError('No Bearer Authorization header specified.');
    }

    const token = authorization?.replace(/^Bearer/, '')?.trimStart();
    const patEntries = await this.storage.find(PAT_STORAGE_TYPE, { pat: token });
    if (patEntries.length === 0) {
      throw new ForbiddenHttpError('Unknown PAT.');
    }
    if (patEntries[0].expiration < Date.now()) {
      throw new ForbiddenHttpError('Expired PAT.');
    }
    const registration = await this.storage.get(CLIENT_REGISTRATION_STORAGE_TYPE, patEntries[0].registration);
    if (!registration) {
      throw new InternalServerError('Unable to find matching client for PAT.');
    }

    return { owner: registration.userId };
  }
}
