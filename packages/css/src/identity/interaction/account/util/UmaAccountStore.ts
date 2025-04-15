import { AccountLoginStorage, AccountStore, GenericAccountStore } from '@solid/community-server';
import { UMA_ACCOUNT_STORAGE_DESCRIPTION, UMA_ACCOUNT_STORAGE_TYPE } from './AccountSettings';

/**
 * A {@link AccountStore} that uses an {@link AccountLoginStorage} to keep track of the accounts.
 * Needs to be initialized before it can be used.
 */
export class UmaAccountStore extends GenericAccountStore<UMA_ACCOUNT_STORAGE_TYPE> {
  public constructor(storage: AccountLoginStorage<Record<string, never>>) {
    super(storage, UMA_ACCOUNT_STORAGE_DESCRIPTION);
  }
}
