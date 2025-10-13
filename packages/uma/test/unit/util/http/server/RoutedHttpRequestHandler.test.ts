import { NotImplementedHttpError } from '@solid/community-server';
import { HttpHandlerContext } from '../../../../../src/util/http/models/HttpHandler';
import { HttpHandlerRoute } from '../../../../../src/util/http/models/HttpHandlerRoute';
import { RoutedHttpRequestHandler } from '../../../../../src/util/http/server/RoutedHttpRequestHandler';

describe('RoutedHttpRequestHandler', (): void => {
  let context: HttpHandlerContext;
  let routes: HttpHandlerRoute[];
  let handler: RoutedHttpRequestHandler;

  beforeEach(async(): Promise<void> => {
    context = {
      request: {
        url: new URL('https://example.com/foo'),
        method: 'GET',
        headers: {},
      },
    };

    routes = [
      { path: '/foo', handler: { handleSafe: vi.fn().mockResolvedValue(1) } as any },
      { path: '/foo/{id}', handler: { handleSafe: vi.fn().mockResolvedValue(2) } as any },
      { path: '/bar', methods: [ 'GET' ], handler: { handleSafe: vi.fn().mockResolvedValue(3) } as any },
    ];

    handler = new RoutedHttpRequestHandler(routes);
  });

  it('can handle requests where there is a match.', async(): Promise<void> => {
    await expect(handler.canHandle(context)).resolves.toBeUndefined();

    context.request.url = new URL('https://example.com/foo/id');
    await expect(handler.canHandle(context)).resolves.toBeUndefined();

    context.request.url = new URL('https://example.com/bar');
    await expect(handler.canHandle(context)).resolves.toBeUndefined();

    context.request.method = 'POST';
    await expect(handler.canHandle(context)).rejects.toThrow('POST is not allowed.');

    context.request.url = new URL('https://example.com/bad');
    await expect(handler.canHandle(context)).rejects.toThrow(NotImplementedHttpError);

    context.request.url = new URL('https://example.com/bar/foo');
    await expect(handler.canHandle(context)).rejects.toThrow(NotImplementedHttpError);
  });

  it('errors calling handle before calling canHandle.', async(): Promise<void> => {
    await expect(handler.handle(context)).rejects.toThrow('Calling handle without successful canHandle');
  });

  it('calls the matched handler.', async(): Promise<void> => {
    await expect(handler.canHandle(context)).resolves.toBeUndefined();
    await expect(handler.handle(context)).resolves.toBe(1);
    expect(routes[0].handler.handleSafe).toHaveBeenCalledTimes(1);
    expect(routes[0].handler.handleSafe).toHaveBeenLastCalledWith({
      request: {
        url: new URL('https://example.com/foo'),
        method: 'GET',
        headers: {},
        parameters: {},
      },
    });
  });

  it('calls the matched handler with the parsed properties.', async(): Promise<void> => {
    context.request.url = new URL('https://example.com/foo/123');
    await expect(handler.canHandle(context)).resolves.toBeUndefined();
    await expect(handler.handle(context)).resolves.toBe(2);
    expect(routes[1].handler.handleSafe).toHaveBeenCalledTimes(1);
    expect(routes[1].handler.handleSafe).toHaveBeenLastCalledWith({
      request: {
        url: new URL('https://example.com/foo/123'),
        method: 'GET',
        headers: {},
        parameters: { id: '123'},
      },
    });
  });

  it('can support routes only matching the route tail.', async(): Promise<void> => {
    routes = [
      { path: '/foo', handler: { handleSafe: vi.fn().mockResolvedValue(1) } as any },
    ];
    handler = new RoutedHttpRequestHandler(routes, true);

    context.request.url = new URL('https://example.com/bar/foo');
    await expect(handler.canHandle(context)).resolves.toBeUndefined();
    await expect(handler.handle(context)).resolves.toBe(1);
    expect(routes[0].handler.handleSafe).toHaveBeenCalledTimes(1);
    expect(routes[0].handler.handleSafe).toHaveBeenLastCalledWith({
      request: {
        url: new URL('https://example.com/bar/foo'),
        method: 'GET',
        headers: {},
        parameters: {
          _prefix: '/bar',
        },
      },
    });
  });
});
