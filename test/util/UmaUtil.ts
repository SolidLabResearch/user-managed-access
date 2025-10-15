import { DialogOutput } from '@solidlab/uma';

/**
 * The initial request to a RS without a token.
 * Returns the parsed WWW-Authenticate header.
 * Only call this function if the response will contain such a header.
 */
export async function noTokenFetch(input: string | URL | Request, init?: RequestInit):
  Promise<{ as_uri: string, ticket: string }> {
  const noTokenResponse = await fetch(input, init);

  expect(noTokenResponse.status).toBe(401);

  const wwwAuthenticateHeader = noTokenResponse.headers.get('WWW-Authenticate') as string;
  expect(typeof wwwAuthenticateHeader).toBe('string');

  const parsedHeader = Object.fromEntries(
    wwwAuthenticateHeader
      .replace(/^UMA /,'')
      .split(', ')
      .map(param => param.split('=').map(s => s.replace(/"/g,'')))
  );
  expect(typeof parsedHeader.as_uri).toBe('string');
  expect(typeof parsedHeader.ticket).toBe('string');
  return parsedHeader;
}

/**
 * Finds the UMA configuration to return the token endpoint.
 */
export async function findTokenEndpoint(uri: string): Promise<string> {
  const configurationUrl = uri + '/.well-known/uma2-configuration';
  const configResponse = await fetch(configurationUrl);
  expect(configResponse.status).toBe(200);
  const configuration = await configResponse.json() as { token_endpoint: string };
  expect(typeof configuration.token_endpoint).toBe('string');
  return configuration.token_endpoint;
}

/**
 * Calls the UMA token endpoint with a token and potentially the given WebID to receive a response.
 * Will error if the response is not an access token.
 */
export async function getToken(ticket: string, endpoint: string, webId?: string): Promise<DialogOutput> {
  const content: Record<string, string> = {
    grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
    ticket: ticket,
  };
  if (webId) {
    content.claim_token = encodeURIComponent(webId);
    content.claim_token_format = 'urn:solidlab:uma:claims:formats:webid';
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(content),
  });

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/json');
  const jsonResponse: DialogOutput =  await response.json() as { access_token: string, token_type: string };

  expect(typeof jsonResponse.access_token).toBe('string');
  expect(jsonResponse.token_type).toBe('Bearer');
  const token = JSON.parse(Buffer.from(jsonResponse.access_token.split('.')[1], 'base64').toString());
  expect(Array.isArray(token.permissions)).toBe(true);

  return jsonResponse;
}

/**
 * Performs a fetch by including the given token in the Authorization header.
 */
export async function tokenFetch(token: DialogOutput, input: string | URL | globalThis.Request, init?: RequestInit):
  Promise<Response> {
  return fetch(input, {
    ...init,
    headers: {
      ...init?.headers,
      authorization: `${token.token_type} ${token.access_token}`
    },
  });
}

/**
 * Does the entire flow of calling a RS, taking the ticket to the RS,
 * and then going back to the RS with the received access token.
 * This only works if the initial RS request fails,
 * and the token request to the UMA server succeeds.
 */
export async function umaFetch(input: string | URL | globalThis.Request, init?: RequestInit, webId?: string):
  Promise<Response> {
  // Parse ticket and UMA server URL from header
  const parsedHeader = await noTokenFetch(input, init);

  // Find UMA server token endpoint
  const tokenEndpoint = await findTokenEndpoint(parsedHeader.as_uri);

  // Send ticket request to UMA server and extract token from response
  const token = await getToken(parsedHeader.ticket, tokenEndpoint, webId);

  // Perform new call with token
  return tokenFetch(token, input, init);
}
