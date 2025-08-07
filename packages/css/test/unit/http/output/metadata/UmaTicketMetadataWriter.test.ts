import { HTTP, HttpResponse, RepresentationMetadata } from '@solid/community-server';
import { Mocked } from 'vitest';
import { WWW_AUTH } from '../../../../../src/authorization/UmaAuthorizer';
import { UmaTicketMetadataWriter } from '../../../../../src/http/output/metadata/UmaTicketMetadataWriter';

describe('A UmaTicketMetadataWriter', () => {
  const header = 'UMA realm="solid",as_uri="https://as.example.org",ticket="def"';

  const writer = new UmaTicketMetadataWriter();
  let response: Mocked<HttpResponse>;

  beforeEach(() => {
    const headers: Record<string, string> = {};
    response = {
      hasHeader: vi.fn().mockImplementation((key: string) => Boolean(headers[key.toLowerCase()])),
      getHeader: vi.fn().mockImplementation((key: string) => headers[key.toLowerCase()]),
      getHeaders: vi.fn().mockReturnValue(headers),
      setHeader: vi.fn().mockImplementation((key: string, value) => headers[key.toLowerCase()] = value),
    } satisfies Partial<HttpResponse> as any;
  });

  it('adds no header if there is no relevant metadata.', async (): Promise<void> => {
    const metadata = new RepresentationMetadata();
    await expect(writer.handle({response, metadata})).resolves.toBeUndefined();
    expect(response.getHeaders()).toEqual({ });
  });

  it('adds a WWW-Authenticate header if the status code is 401.', async (): Promise<void> => {
    const metadata = new RepresentationMetadata({
      [HTTP.statusCodeNumber]: '401',
      [WWW_AUTH.value]: header});
    await expect(writer.handle({response, metadata})).resolves.toBeUndefined();

    expect(response.getHeaders()).toEqual({
      'www-authenticate': 'UMA realm=\"solid\",as_uri=\"https://as.example.org\",ticket=\"def\"',
    });
  });

  it('adds a WWW-Authenticate header if the status code is 403.', async (): Promise<void> => {
    const metadata = new RepresentationMetadata({
      [HTTP.statusCodeNumber]: '403',
      [WWW_AUTH.value]: header});
    await expect(writer.handle({response, metadata})).resolves.toBeUndefined();

    expect(response.getHeaders()).toEqual({
      'www-authenticate': 'UMA realm=\"solid\",as_uri=\"https://as.example.org\",ticket=\"def\"',
    });
  });

  it('adds no header if the status code is not 401 or 403.', async (): Promise<void> => {
    const metadata = new RepresentationMetadata({
      [HTTP.statusCodeNumber]: '400',
      [WWW_AUTH.value]: header});
    await expect(writer.handle({response, metadata})).resolves.toBeUndefined();

    expect(response.getHeaders()).toEqual({});
  });
});
