import { HttpRequest } from '@solid/community-server';
import { BaseTargetExtractor } from '../../../../../src/util/http/identifier/BaseTargetExtractor';

describe('BaseTargetExtractor', (): void => {
  it('creates a target extractor without needing an identifier strategy.', async(): Promise<void> => {
    let extractor = new BaseTargetExtractor();
    const request: HttpRequest = { url: 'foo?key=val', headers: { host: 'example.com' }} as any;
    await expect(extractor.canHandle({ request })).resolves.toBeUndefined();
    await expect(extractor.handle({ request })).resolves.toEqual({ path: 'http://example.com/foo' });

    extractor = new BaseTargetExtractor(true);
    await expect(extractor.handle({ request })).resolves.toEqual({ path: 'http://example.com/foo?key=val' });
  });
});
