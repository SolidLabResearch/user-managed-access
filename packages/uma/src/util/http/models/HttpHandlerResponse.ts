import { OutgoingHttpHeaders } from 'http';

export interface HttpHandlerResponse<B = unknown> {
  body?: B;
  headers?: OutgoingHttpHeaders;
  status: number;
}
