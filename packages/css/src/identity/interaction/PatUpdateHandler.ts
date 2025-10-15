import {
  assertAccountId,
  EmptyObject,
  JsonInteractionHandler,
  JsonInteractionHandlerInput,
  JsonRepresentation,
  JsonView,
  parseSchema,
  validateWithError
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { object, string } from 'yup';
import { PatUpdater } from '../PatUpdater';

const inSchema = object({
  id: string().trim().required(),
  secret: string().trim().required(),
  issuer: string().trim().required(),
});

/**
 * Updates the user's PAT credentials and corresponding issuer settings.
 * All user's resources will be registered recursively at the issuer using these credentials.
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

    const { id, secret, issuer } = await validateWithError(inSchema, json);
    await this.patUpdater.updateSettings(accountId, id, secret, issuer);

    return { json: {}};
  }
}
