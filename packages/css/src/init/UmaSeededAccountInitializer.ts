import { readJson } from 'fs-extra';
import { array, object, string } from 'yup';
import { PasswordStore, PodCreator, URL_SCHEMA, getLoggerFor,
  createErrorMessage, Initializer} from '@solid/community-server';
import { ACCOUNT_SETTINGS_AUTHZ_SERVER, ACCOUNT_SETTINGS_KEYS,
  type AccountStore } from '../identity/interaction/account/util/AccountStore'

const inSchema = array().of(object({
  email: string().trim().email().lowercase().required(),
  password: string().trim().min(1).required(),
  authz: object({
    server: string()
  }).optional(),
  keys: array().of(string().required()).optional(),
  pods: array().of(object({
    name: string().trim().min(1).required(),
    settings: object({
      webId: URL_SCHEMA,
    }).optional(),
  })).optional(),
})).required();

export interface SeededAccountInitializerArgs {
  /**
   * Creates the accounts.
   */
  accountStore: AccountStore;
  /**
   * Adds the login methods.
   */
  passwordStore: PasswordStore;
  /**
   * Creates the pods.
   */
  podCreator: PodCreator;
  /**
   * File path of the JSON describing the accounts to seed.
   */
  configFilePath?: string;
}

/**
 * Initializes a set of accounts based on the input data.
 * These accounts have exactly 1 email/password login method, and 0 or more pods.
 * The pod settings that can be defined are identical to those of the {@link CreatePodHandler}.
 */
export class UmaSeededAccountInitializer extends Initializer {
  protected readonly logger = getLoggerFor(this);

  private readonly accountStore: AccountStore;
  private readonly passwordStore: PasswordStore;
  private readonly podCreator: PodCreator;
  private readonly configFilePath?: string;

  public constructor(args: SeededAccountInitializerArgs) {
    super();
    this.accountStore = args.accountStore;
    this.passwordStore = args.passwordStore;
    this.podCreator = args.podCreator;
    this.configFilePath = args.configFilePath;
  }

  public async handle(): Promise<void> {
    // This value being undefined means that the variable linking to the seed config is not defined
    // and this class should just do nothing.
    if (!this.configFilePath) {
      return;
    }

    let configuration: typeof inSchema.__outputType;
    try {
      configuration = await inSchema.validate(await readJson(this.configFilePath, 'utf8'));
    } catch (error: unknown) {
      const msg = `Invalid account seed file: ${createErrorMessage(error)}`;
      this.logger.error(msg);
      throw new Error(msg);
    }

    let accountCount = 0;
    let podCount = 0;
    for await (const { email, password, pods, authz, keys } of configuration) {
      try {
        this.logger.info(`Creating account for ${email}`);
        const accountId = await this.accountStore.create();

        if (keys) {
          await this.accountStore.updateSetting(accountId, ACCOUNT_SETTINGS_KEYS, keys)
        }

        if (authz?.server) {
          await this.accountStore.updateSetting(accountId, ACCOUNT_SETTINGS_AUTHZ_SERVER, authz.server)
        }

        const id = await this.passwordStore.create(email, accountId, password);
        await this.passwordStore.confirmVerification(id);
        accountCount += 1;

        for (const { name, settings } of pods ?? []) {
          this.logger.info(`Creating pod with name ${name}`);
          await this.podCreator.handleSafe({ accountId, name, webId: settings?.webId, settings });
          podCount += 1;
        }
      } catch (error: unknown) {
        this.logger.warn(`Error while initializing seeded account: ${createErrorMessage(error)}`);
      }
    }
    this.logger.info(`Initialized ${accountCount} accounts and ${podCount} pods.`);
  }
}
