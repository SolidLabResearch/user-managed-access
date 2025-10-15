import {
  AccountStore,
  assertAccountId,
  createErrorMessage,
  EmptyObject,
  getLoggerFor,
  isContainerIdentifier,
  JsonInteractionHandler,
  JsonInteractionHandlerInput,
  JsonRepresentation, JsonView,
  LDP, parseSchema,
  PodStore,
  ResourceStore,
  validateWithError
} from '@solid/community-server';
import { json } from 'node:stream/consumers';
import { object, string } from 'yup';
import { UmaClient } from '../../uma/UmaClient';
import { PatUpdater } from '../PatUpdater';
import {
  ACCOUNT_SETTINGS_AS_TOKEN,
  ACCOUNT_SETTINGS_AUTHZ_SERVER,
  UMA_ACCOUNT_STORAGE_TYPE
} from './account/util/AccountSettings';

const inSchema = object({
  pat: string().trim().required(),
  issuer: string().trim().required(),
});

/**
 * Updates the user's PAT and corresponding issuer settings.
 * All user's resources will be registered recursively at the issuer using this new PAT.
 */
export class PatUpdateHandler extends JsonInteractionHandler<EmptyObject> implements JsonView {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    protected readonly patUpdater: PatUpdater,
  ) {
    super();
  }

  public async getView(input: JsonInteractionHandlerInput): Promise<JsonRepresentation> {
    return { json: parseSchema(inSchema)};
  }

  public async handle({ accountId, json }: JsonInteractionHandlerInput): Promise<JsonRepresentation<EmptyObject>> {
    assertAccountId(accountId);

    const { pat, issuer } = await validateWithError(inSchema, json);
    await this.patUpdater.updateSettings(accountId, pat, issuer);

    return { json: {}};
  }
}
