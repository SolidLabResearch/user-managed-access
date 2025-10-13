import { HttpRequest, OriginalUrlExtractor, ResourceIdentifier, TargetExtractor } from '@solid/community-server';

/**
 * Class designed to wrap around the CSS OriginalUrlExtractor,
 * so we don't need an identifier strategy.
 * Ideally the original CSS class would be changed to split off that functionality.
 */
export class BaseTargetExtractor extends TargetExtractor {
  protected readonly extractor: TargetExtractor;

  public constructor(includeQueryString = false) {
    super();
    this.extractor = new OriginalUrlExtractor({
      includeQueryString,
      identifierStrategy: {
        // Only this one matters
        supportsIdentifier: () => true,
        contains: () => false,
        getParentContainer: () => ({ path: '' }),
        isRootContainer: () => true,
      }
    })
  }

  public async canHandle(input: { request: HttpRequest }): Promise<void> {
    return this.extractor.canHandle(input);
  }

  handle(input: { request: HttpRequest }): Promise<ResourceIdentifier> {
    return this.extractor.handle(input);
  }
}
