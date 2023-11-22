/* eslint-disable require-jsdoc */
import {OAuthConfigRequestHandler, OAuthConfiguration} from './OAuthConfigRequestHandler';
import {lastValueFrom} from 'rxjs';

class DummyOAuthConfigHandler extends OAuthConfigRequestHandler {
  getConfig(): OAuthConfiguration {
    return {
      issuer: 'https://example.org/idp',
    };
  }
}

describe('An OAuthConfigRequestHandler', () => {
  const handler = new DummyOAuthConfigHandler();

  it('should return the configuration in json format', async () => {
    const result = await lastValueFrom(handler.handle({
      request: {
        url: new URL('https://example.org/idp/.well-known/openid-configuration'),
        headers: {},
        method: 'GET',
      },
    }));
    expect(result.status).toEqual(200);
    expect(result.headers['content-type']).toEqual('application/json');
    expect(result.body).toBeDefined();
    expect(JSON.parse(result.body)).toEqual({issuer: 'https://example.org/idp'});
  });
});
