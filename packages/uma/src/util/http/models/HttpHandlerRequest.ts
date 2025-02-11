export interface HttpHandlerRequest<B = any> {
  url: URL;
  method: string;
  parameters?: { [key: string]: string };
  headers: { [key: string]: string };
  body?: B;
}
