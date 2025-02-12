export interface HttpHandlerRequest<B = unknown> {
  url: URL;
  method: string;
  parameters?: { [key: string]: string };
  headers: { [key: string]: string };
  body?: B;
}
