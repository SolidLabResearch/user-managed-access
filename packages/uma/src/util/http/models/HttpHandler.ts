import { AsyncHandler } from 'asynchronous-handlers';
import { OutgoingHttpHeaders } from 'http';
import { Readable } from 'node:stream';

export interface HttpHandlerContext<B = unknown> {
  request: HttpHandlerRequest<B>;
}

export interface HttpHandlerRequest<B = unknown> {
  url: URL;
  method: string;
  parameters?: { [key: string]: string };
  headers: { [key: string]: string };
  body?: B;
}

export type StreamResponseBody = Readable | NodeJS.ReadableStream;

export interface HttpHandlerResponse<B = unknown> {
  body?: B;
  headers?: OutgoingHttpHeaders;
  status: number;
}

export abstract class HttpHandler<C extends HttpHandlerContext = HttpHandlerContext, B = unknown>
  extends AsyncHandler<C, HttpHandlerResponse<B>> { }
