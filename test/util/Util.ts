import { joinUrl } from '@solid/community-server';

/**
 * This is needed when you want to wait for all promises to resolve.
 * Also works when using vi.useFakeTimers().
 * For more details see the links below
 *  - https://github.com/facebook/jest/issues/2157
 *  - https://stackoverflow.com/questions/52177631/jest-timer-and-promise-dont-work-well-settimeout-and-async-function
 */
export async function flushPromises(): Promise<void> {
  return new Promise((await vi.importActual('timers')).setImmediate as any);
}

/**
 * Registers client credentials for the given CSS account/WebID.
 */
export async function generateCssClientCredentials(serverUrl: string, email: string, password: string,
  webId: string): Promise<{ id: string, secret: string }> {
  let indexResponse = await fetch(joinUrl(serverUrl, '.account/'));
  let { controls } = await indexResponse.json() as any;

  let response = await fetch(controls.password.login, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const { authorization } = await response.json() as any;

  indexResponse = await fetch(joinUrl(serverUrl, '.account/'), {
    headers: { authorization: `CSS-Account-Token ${authorization}` }
  });
  ({ controls } = await indexResponse.json() as any);

  response = await fetch(controls.account.clientCredentials, {
    method: 'POST',
    headers: { authorization: `CSS-Account-Token ${authorization}`, 'content-type': 'application/json' },
    body: JSON.stringify({ webId }),
  });

  return response.json() as any;
}

/**
 * Uses the generated client credentials to request an access token.
 */
export async function generateCssClientCredentialsToken(serverUrl: string, id: string, secret: string):
  Promise<string> {
  const authString = `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`;
  const tokenUrl = joinUrl(serverUrl, '.oidc/token');
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(authString).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=webid',
  });

  const { access_token: accessToken } = await response.json() as any;
  return accessToken;
}
