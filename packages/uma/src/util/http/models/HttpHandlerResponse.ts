export interface HttpHandlerResponse<B = any> {
  body?: B;
  headers?: { [key: string]: string };
  status: number;
}
