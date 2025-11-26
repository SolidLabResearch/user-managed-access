import { ForbiddenHttpError, UnauthorizedHttpError } from '@solid/community-server';
import { MappedSchemeParser } from '../../../../src/credentials/parse/MappedSchemeParser';

describe('MappedSchemeParser', (): void => {
  let map = {
    'scheme1': 'format1',
    'scheme2': 'format2',
  };

  const parser = new MappedSchemeParser(map);

  it('rejects requests without authorization headers.', async(): Promise<void> => {
    const request = { headers: {} } as any;
    await expect(parser.canHandle(request)).rejects.toThrow(UnauthorizedHttpError);
  });

  it('rejects unknown schemes.', async(): Promise<void> => {
    const request = { headers: { authorization: 'unknown value' } } as any;
    await expect(parser.canHandle(request)).rejects.toThrow(ForbiddenHttpError);
  });

  it('accepts known schemes.', async(): Promise<void> => {
    const request = { headers: { authorization: 'scheme1 value' } } as any;
    await expect(parser.canHandle(request)).resolves.toBeUndefined();
  });

  it('returns the parsed header value.', async(): Promise<void> => {
    const request = { headers: { authorization: 'scheme1 value' } } as any;
    await expect(parser.handle(request)).resolves.toEqual({ token: 'value', format: 'format1' });
  });
});
