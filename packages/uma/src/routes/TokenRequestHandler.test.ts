import {TokenRequestHandler} from './TokenRequestHandler';
import {lastValueFrom} from 'rxjs';
import {BadRequestHttpError} from '../http/errors/BadRequestHttpError';
import {HttpHandlerContext} from '../http/models/HttpHandlerContext';
import {UnsupportedMediaTypeHttpError} from '../http/errors/UnsupportedMediaTypeHttpError';

describe('Happy flows', () => {
  let requestHandler: TokenRequestHandler;
  let requestContext: HttpHandlerContext;
  const getSupportedGrantType = jest.fn();
  const process = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    getSupportedGrantType.mockReturnValue('urn:ietf:params:oauth:grant-type:uma-ticket');
    requestHandler = new TokenRequestHandler([{process, getSupportedGrantType}]);
    requestContext = {
      request: {
        url: new URL('http://localhost/token'),
        method: 'POST',
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Auma-ticket` +
        `&ticket=016f84e8-f9b9-11e0-bd6f-0021cc6004de` +
        `&claim_token=abc` +
        `&claim_token_format=http%3A%2F%2Fopenid.net%2Fspecs%2Fopenid-connect-core-1_0.html%23IDToken`,
        headers: {'content-type': 'application/x-www-form-urlencoded'},
      },
    };
  });

  test('Returns Token in response body', async () => {
    process.mockReturnValueOnce(new Promise((resolve, reject) => {
      resolve({token_type: 'Bearer', access_token: 'abc'});
    }));
    const response = await lastValueFrom(requestHandler.handle(requestContext));
    expect(response.body).toEqual(JSON.stringify({token_type: 'Bearer', access_token: 'abc'}));
    expect(response.status).toEqual(200);
  });
});

describe('Unhappy flows', () => {
  let requestHandler: TokenRequestHandler;
  const getSupportedGrantType = jest.fn();
  const process = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    getSupportedGrantType.mockReturnValue('urn:ietf:params:oauth:grant-type:uma-ticket');
    requestHandler = new TokenRequestHandler([{process, getSupportedGrantType}]);
  });

  test('Invalid media type', async () => {
    expect(lastValueFrom(requestHandler.handle({
      request: {
        url: new URL('http://localhost/token'),
        method: 'POST',
        headers: {'content-type': 'application/json'},
      },
    }))).rejects.toThrow(UnsupportedMediaTypeHttpError);
  });
  test('Missing \'grant_type\' in body.', async () => {
    expect(lastValueFrom(requestHandler.handle({
      request: {
        url: new URL('http://localhost/token'),
        method: 'POST',
        body: ``,
        headers: {'content-type': 'application/x-www-form-urlencoded'},
      },
    }))).rejects.toThrow(BadRequestHttpError);
  });
  test('Empty \'grant_type\' in body.', async () => {
    expect(lastValueFrom(requestHandler.handle({
      request: {
        url: new URL('http://localhost/token'),
        method: 'POST',
        body: `grant_type=`,
        headers: {'content-type': 'application/x-www-form-urlencoded'},
      },
    }))).rejects.toThrow(BadRequestHttpError);
  });
  test('Unsupported \'grant_type\' in body.', async () => {
    expect(lastValueFrom(requestHandler.handle({
      request: {
        url: new URL('http://localhost/token'),
        method: 'POST',
        body: `grant_type=abc`,
        headers: {'content-type': 'application/x-www-form-urlencoded'},
      },
    }))).rejects.toThrow('Unsupported grant type: \'abc\'');
  });
  test('When `process` throws an error, should rethrow it.', async () => {
    process.mockReturnValue(new Promise((resolve, reject) => {
      reject(new Error('Test'));
    }));
    expect(lastValueFrom(requestHandler.handle({
      request: {
        url: new URL('http://localhost/token'),
        method: 'POST',
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Auma-ticket`,
        headers: {'content-type': 'application/x-www-form-urlencoded'},
      },
    }))).rejects.toThrow('Test');
  });
});
