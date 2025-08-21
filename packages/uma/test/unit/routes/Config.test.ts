import { ConfigRequestHandler } from '../../../src/routes/Config';

describe('Config', (): void => {
  const baseUrl = 'http://example.com/uma';

  let config = new ConfigRequestHandler(baseUrl);

  it('returns the configuration.', async(): Promise<void> => {
    await expect(config.handle({ request: { url: 'url' } } as any)).resolves.toEqual({
      status: 200,
      body: {
        jwks_uri: 'http://example.com/uma/keys',
        token_endpoint: 'http://example.com/uma/token',
        grant_types_supported: ['urn:ietf:params:oauth:grant-type:uma-ticket'],
        issuer: 'http://example.com/uma',
        permission_endpoint: 'http://example.com/uma/ticket',
        introspection_endpoint: 'http://example.com/uma/introspect',
        resource_registration_endpoint: 'http://example.com/uma/resources/',
        uma_profiles_supported: ['http://openid.net/specs/openid-connect-core-1_0.html#IDToken'],
        dpop_signing_alg_values_supported:
          expect.arrayContaining(['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512', 'PS256', 'PS384', 'PS512']),
        response_types_supported: ['token'],
      }
    });
  });
});
