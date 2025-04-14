import { AsyncHandler } from '@solid/community-server';
import { OutgoingHttpHeaders } from 'http';

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

export interface HttpHandlerResponse<B = unknown> {
  body?: B;
  headers?: OutgoingHttpHeaders;
  status: number;
}

export abstract class HttpHandler<C extends HttpHandlerContext = HttpHandlerContext, B = unknown>
  extends AsyncHandler<C, HttpHandlerResponse<B>> { }
