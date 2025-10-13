import { UnsupportedMediaTypeHttpError } from '@solid/community-server';
import { Mocked } from 'vitest';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../../../../../src/util/http/models/HttpHandler';
import { JsonFormHttpHandler } from '../../../../../src/util/http/server/JsonFormHttpHandler';

describe('JsonFormHttpHandler', (): void => {
  const formString = 'key=form';
  const jsonString = '{ "key": "json" }';
  let context: HttpHandlerContext<Buffer>;
  let response: HttpHandlerResponse;
  let source: Mocked<HttpHandler>;
  let handler: JsonFormHttpHandler;

  beforeEach(async(): Promise<void> => {
    context = {
      request: {
        url: new URL('http://example.com/foo'),
        method: 'GET',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: Buffer.from(formString),
      },
    };

    response = {
      body: { key: 'response' },
      headers: {},
      status: 200,
    }

    source = {
      canHandle: vi.fn(),
      handle: vi.fn().mockResolvedValue(response),
      handleSafe: vi.fn(),
    };

    handler = new JsonFormHttpHandler(source);
  });

  it('can handle form data.', async(): Promise<void> => {
    context.request.headers['content-type'] = 'application/x-www-form-urlencoded';
    context.request.body = Buffer.from(formString);
    await expect(handler.canHandle(context)).resolves.toBeUndefined();
    expect(source.canHandle).toHaveBeenCalledTimes(1);
    expect(source.canHandle).toHaveBeenLastCalledWith({ request: { ...context.request, body: { key: 'form' }} });
  });

  it('can handle json data.', async(): Promise<void> => {
    context.request.headers['content-type'] = 'application/json';
    context.request.body = Buffer.from(jsonString);
    await expect(handler.canHandle(context)).resolves.toBeUndefined();
    expect(source.canHandle).toHaveBeenCalledTimes(1);
    expect(source.canHandle).toHaveBeenLastCalledWith({ request: { ...context.request, body: { key: 'json' }} });
  });

  it('can not handle other data types.', async(): Promise<void> => {
    context.request.headers['content-type'] = 'text/plain';
    context.request.body = Buffer.from(jsonString);
    await expect(handler.canHandle(context)).rejects.toThrow(UnsupportedMediaTypeHttpError);
    expect(source.canHandle).toHaveBeenCalledTimes(0);
  });

  it('errors calling the handle function before calling canHandle', async(): Promise<void> => {
    await expect(handler.handle(context)).rejects.toThrow('Calling handle before calling canHandle.');
  });

  it('returns the source response if it has no body.', async(): Promise<void> => {
    delete response.body;
    await expect(handler.canHandle(context)).resolves.toBeUndefined();
    await expect(handler.handle(context)).resolves.toEqual(response);
    expect(source.handle).toHaveBeenCalledTimes(1);
    expect(source.handle).toHaveBeenLastCalledWith({ request: { ...context.request, body: { key: 'form' }} });
  });

  it('returns the string response as buffer if content-type is provided.', async(): Promise<void> => {
    response.body = 'text';
    response.headers!['content-type'] = 'text/plain';
    await expect(handler.canHandle(context)).resolves.toBeUndefined();
    await expect(handler.handle(context)).resolves.toEqual({ ...response, body: Buffer.from('text') });
  });

  it('returns the buffer response if content-type is provided.', async(): Promise<void> => {
    response.body = Buffer.from('text');
    response.headers!['content-type'] = 'text/plain';
    await expect(handler.canHandle(context)).resolves.toBeUndefined();
    await expect(handler.handle(context)).resolves.toEqual(response);
  });

  it('converts output objects to form data if requested.', async(): Promise<void> => {
    context.request.headers.accept = 'application/x-www-form-urlencoded';
    await expect(handler.canHandle(context)).resolves.toBeUndefined();
    await expect(handler.handle(context)).resolves.toEqual({
      ...response,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: Buffer.from('key=response'),
    });
  });

  it('converts output objects to JSON data if requested.', async(): Promise<void> => {
    context.request.headers.accept = 'application/json';
    await expect(handler.canHandle(context)).resolves.toBeUndefined();
    await expect(handler.handle(context)).resolves.toEqual({
      ...response,
      headers: { 'content-type': 'application/json' },
      body: Buffer.from('{"key":"response"}'),
    });
  });

  it('converts output objects to JSON if there was no accept header.', async(): Promise<void> => {
    await expect(handler.canHandle(context)).resolves.toBeUndefined();
    await expect(handler.handle(context)).resolves.toEqual({
      ...response,
      headers: { 'content-type': 'application/json' },
      body: Buffer.from('{"key":"response"}'),
    });
  });

  it('errors if the output data cannot be converted to the requested type.', async(): Promise<void> => {
    context.request.headers.accept = 'text/plain';
    await expect(handler.canHandle(context)).resolves.toBeUndefined();
    await expect(handler.handle(context)).rejects.toThrow('Unable to convert output to JSON or urlencoded data.');
  });
});
