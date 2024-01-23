import {JwksRequestHandler} from './JwksRequestHandler';
import {InMemoryJwksKeyHolder} from '../secrets/InMemoryJwksKeyHolder';
import {lastValueFrom} from 'rxjs';
import {HttpHandlerContext} from '../http/models/HttpHandlerContext';

describe('Happy flows', () => {
  const keyHolder = new InMemoryJwksKeyHolder('ES256');
  const requestHandler = new JwksRequestHandler(keyHolder);
  let requestContext: HttpHandlerContext;

  beforeEach(() => {
    requestContext = {
      request: {
        url: new URL('http://localhost/'),
        method: 'GET',
        headers: {},
      },
    };
  });

  test('Returns JWKS in response body', async () => {
    const response = await lastValueFrom(requestHandler.handle(requestContext));
    expect(response.body).toEqual(JSON.stringify(await keyHolder.getJwks()));
    expect(response.status).toEqual(200);
  });
});
