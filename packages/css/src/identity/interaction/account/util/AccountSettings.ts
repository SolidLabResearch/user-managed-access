import { ACCOUNT_SETTINGS_REMEMBER_LOGIN } from '@solid/community-server';

/**
 * Settings parameter containing the URL of the user's Authorization Server.
 */
export const ACCOUNT_SETTINGS_AUTHZ_SERVER = 'authzServer';

/**
 * Settings parameter containing the Personal Access Token (PAT) of the user at their AS.
 */
export const ACCOUNT_SETTINGS_AS_TOKEN = 'asToken';

/**
 * Settings parameter containing the private key of the user.
 */
export const ACCOUNT_SETTINGS_KEYS = 'keys';

export const UMA_ACCOUNT_STORAGE_DESCRIPTION = {
  [ACCOUNT_SETTINGS_REMEMBER_LOGIN]: 'boolean?',
  [ACCOUNT_SETTINGS_AUTHZ_SERVER]: 'string?',
  [ACCOUNT_SETTINGS_AS_TOKEN]: 'string?',
  [ACCOUNT_SETTINGS_KEYS]: 'string[]?',
} as const;

// Duplication but needed to get around Components.js limitations
export type UMA_ACCOUNT_STORAGE_TYPE = {
  [ACCOUNT_SETTINGS_REMEMBER_LOGIN]: 'boolean?',
  [ACCOUNT_SETTINGS_AUTHZ_SERVER]: 'string?',
  [ACCOUNT_SETTINGS_AS_TOKEN]: 'string?',
  [ACCOUNT_SETTINGS_KEYS]: 'string[]?',
}
