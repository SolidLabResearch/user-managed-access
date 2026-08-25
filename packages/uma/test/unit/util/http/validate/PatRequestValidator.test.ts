import { IndexedStorage } from '@solid/community-server';
import { Mocked } from 'vitest';
import {
  CLIENT_REGISTRATION_STORAGE_DESCRIPTION,
  CLIENT_REGISTRATION_STORAGE_TYPE
} from '../../../../../src/routes/ClientRegistration';
import { PAT_STORAGE_DESCRIPTION, PAT_STORAGE_TYPE } from '../../../../../src/routes/token/UmaProtection';
import { HttpHandlerRequest } from '../../../../../src/util/http/models/HttpHandler';
import { PatRequestValidator } from '../../../../../src/util/http/validate/PatRequestValidator';

describe('PatRequestValidator', (): void => {
  const registrationId = 'registrationId';
  const userId = 'userId';
  const pat = 'pat';
  let request: HttpHandlerRequest;

  let storage: Mocked<IndexedStorage<{
    [CLIENT_REGISTRATION_STORAGE_TYPE]: typeof CLIENT_REGISTRATION_STORAGE_DESCRIPTION,
    [PAT_STORAGE_TYPE]: typeof PAT_STORAGE_DESCRIPTION,
  }>>;
  let validator: PatRequestValidator;

  beforeEach(async(): Promise<void> => {
    request = {
      url: new URL('http://example.com/foo'),
      parameters: {},
      headers: { authorization: `Bearer ${pat}` },
      method: 'GET'
    }

    storage = {
      find: vi.fn().mockResolvedValue([{ expiration: Date.now() + 5000, registration: registrationId }]),
      findIds: vi.fn().mockResolvedValue([ registrationId ]),
      get: vi.fn().mockResolvedValue({ userId }),
    } as any;

    validator = new PatRequestValidator(storage as any);
  });

  it('can only handle Bearer tokens.', async(): Promise<void> => {
    request.headers.authorization = 'Basic 1234';
    await expect(validator.canHandle({ request })).rejects.toThrow('No Bearer Authorization header specified.');
  });

  it('can only handle known tokens.', async(): Promise<void> => {
    storage.findIds.mockResolvedValueOnce([]);
    await expect(validator.canHandle({ request })).rejects.toThrow('Unknown PAT.');
  });

  it('can handle known Bearer tokens.', async(): Promise<void> => {
    await expect(validator.canHandle({ request })).resolves.toBeUndefined();
  });

  it('returns the stored user as owner.', async(): Promise<void> => {
    await expect(validator.handle({ request })).resolves.toEqual({ owner: userId });
    expect(storage.find).toHaveBeenLastCalledWith(PAT_STORAGE_TYPE, { pat });
    expect(storage.get).toHaveBeenLastCalledWith(CLIENT_REGISTRATION_STORAGE_TYPE, registrationId);
  });

  it('errors if the PAT is expired.', async(): Promise<void> => {
    storage.find.mockResolvedValueOnce([{ expiration: Date.now() - 5000, registration: registrationId }] as any);
    await expect(validator.handle({ request })).rejects.toThrow('Expired PAT.');
  });
});
