import {UmaConfigRequestHandler} from './UmaConfigRequestHandler';
import {lastValueFrom} from 'rxjs';
import {HttpHandlerContext} from '../http/models/HttpHandlerContext';

const BASE_URL = 'https://example.org';

describe('Happy flows', () => {
  const requestHandler = new UmaConfigRequestHandler(BASE_URL);
  let requestContext: HttpHandlerContext;

  beforeEach(() => {
    requestContext = {
      request: {
        url: new URL(BASE_URL),
        method: 'GET',
        headers: {},
      },
    };
  });
  test('Handles GET request with configuration in body', async () => {
    const response = await lastValueFrom(requestHandler.handle(requestContext));
    expect(JSON.parse(response.body)).toEqual({
      'jwks_uri': `${BASE_URL}/keys`,
      'token_endpoint': `${BASE_URL}/token`,
      'grant_types_supported': [
        'urn:ietf:params:oauth:grant-type:uma-ticket',
      ],
      'dpop_signing_alg_values_supported': [
        'ES256',
        'ES384',
        'ES512',
        'PS256',
        'PS384',
        'PS512',
        'RS256',
        'RS384',
        'RS512',
      ],
      'issuer': 'https://example.org',
      'response_types_supported': [
        'token',
      ],
      'permission_registration_endpoint': 'https://example.org/register',
      'uma_profiles_supported': [
        'http://openid.net/specs/openid-connect-core-1_0.html#IDToken',
      ],
    });
    expect(response.status).toEqual(200);
  });
});
