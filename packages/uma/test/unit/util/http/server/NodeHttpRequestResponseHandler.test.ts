import {
  HttpHandlerInput,
  HttpRequest,
  HttpResponse,
  readableToString,
  TargetExtractor
} from '@solid/community-server';
import { PassThrough, Readable } from 'node:stream';
import { Mocked } from 'vitest';
import { HttpHandler, HttpHandlerContext } from '../../../../../src/util/http/models/HttpHandler';
import { NodeHttpRequestResponseHandler } from '../../../../../src/util/http/server/NodeHttpRequestResponseHandler';

describe('NodeHttpRequestResponseHandler', (): void => {
  const path = 'https://example.com/foo';

  let input: HttpHandlerInput;

  let source: Mocked<HttpHandler<HttpHandlerContext<Buffer>, Buffer>>;
  let extractor: Mocked<TargetExtractor>;
  let handler: NodeHttpRequestResponseHandler;

  beforeEach(async(): Promise<void> => {
    const request: HttpRequest = Readable.from('body') as any;
    request.method = 'GET';
    request.headers = {
      'content-type': 'text/plain',
      'content-length': '5',
      'transfer-encoding': 'encoding',
    };

    const response: HttpResponse = new PassThrough() as any;
    response.writeHead = vi.fn();

    input = { request, response };

    source = {
      canHandle: vi.fn(),
      handle: vi.fn(),
      handleSafe: vi.fn().mockResolvedValue({
        status: 200,
        headers: {
          'content-type': 'text/plain',
        },
        body: Buffer.from('response'),
      }),
    }

    extractor = {
      canHandle: vi.fn(),
      handle: vi.fn(),
      handleSafe: vi.fn().mockResolvedValue({ path }),
    };

    handler = new NodeHttpRequestResponseHandler(source, extractor);
  });

  it('sends the request to its source and writes out the output.', async(): Promise<void> => {
    await expect(handler.handle(input)).resolves.toBeUndefined();
    expect(source.handleSafe).toHaveBeenCalledTimes(1);
    expect(source.handleSafe).toHaveBeenLastCalledWith({
      request: {
        url: new URL(path),
        method: 'GET',
        headers: {
          'content-type': 'text/plain',
          'content-length': '5',
          'transfer-encoding': 'encoding',
        },
        body: Buffer.from('body'),
      }
    });
    await expect(readableToString(input.response as any)).resolves.toEqual('response');
    expect(input.response.writeHead).toHaveBeenCalledTimes(1);
    expect(input.response.writeHead).toHaveBeenLastCalledWith(200, {
      'content-type': 'text/plain',
      'content-length': '8'
    });
  });

  it('errors if there is no request method.', async(): Promise<void> => {
    delete input.request.method;
    await expect(handler.handle(input)).rejects.toThrow('method of the request cannot be null or undefined.');
    expect(source.handleSafe).toHaveBeenCalledTimes(0);
  });

  it('errors if there is an input body without content type.', async(): Promise<void> => {
    delete input.request.headers['content-type'];
    await expect(handler.handle(input)).rejects.toThrow('HTTP request body was passed without a Content-Type header');
    expect(source.handleSafe).toHaveBeenCalledTimes(0);
  });
});
