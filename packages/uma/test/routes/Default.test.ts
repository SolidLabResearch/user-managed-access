import {HttpHandlerContext} from '../http/models/HttpHandlerContext';
import {lastValueFrom} from 'rxjs';
import {DefaultRouteHandler} from './DefaultRouteHandler';

describe('Happy flows', () => {
  const routeHandler = new DefaultRouteHandler();
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

  test('Should return 404', async () => {
    const response = await lastValueFrom(routeHandler.handle(requestContext));
    expect(response.status).toEqual(404);
  });
});
