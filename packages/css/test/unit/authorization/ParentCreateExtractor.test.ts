import {
  AccessMap, AccessMode,
  IdentifierSetMultiMap,
  IdentifierStrategy,
  ModesExtractor,
  Operation,
  ResourceSet
} from '@solid/community-server';
import { expect, Mocked } from 'vitest';
import { ParentCreateExtractor } from '../../../src/authorization/ParentCreateExtractor';

describe('ParentCreateExtractor', (): void => {
  const input: Operation = { key: 'value' } as any;
  let source: Mocked<ModesExtractor>;
  let strategy: Mocked<IdentifierStrategy>;
  let resourceSet: Mocked<ResourceSet>;
  let extractor: ParentCreateExtractor;

  beforeEach(async(): Promise<void> => {
    source = {
      canHandle: vi.fn(),
      handle: vi.fn(),
    } satisfies Partial<ModesExtractor> as any;

    strategy = {
      isRootContainer: vi.fn(),
      getParentContainer: vi.fn(),
    } satisfies Partial<IdentifierStrategy> as any;

    resourceSet = {
      hasResource: vi.fn(),
    };

    extractor = new ParentCreateExtractor(source, strategy, resourceSet);
  });

  it('can handle results the source can handle.', async(): Promise<void> => {
    await expect(extractor.canHandle(input)).resolves.toBeUndefined();
    expect(source.canHandle).toHaveBeenCalledTimes(1);
    expect(source.canHandle).toHaveBeenLastCalledWith(input);

    const error = new Error('bad data');
    source.canHandle.mockRejectedValueOnce(error);
    await expect(extractor.canHandle(input)).rejects.toThrow(error);
    expect(source.canHandle).toHaveBeenCalledTimes(2);
    expect(source.canHandle).toHaveBeenLastCalledWith(input);
  });

  it('returns the same result if the resource exists.', async(): Promise<void> => {
    const output: AccessMap = new IdentifierSetMultiMap<AccessMode>([
      [{ path: 'id' }, new Set([AccessMode.read])],
    ]);
    source.handle.mockResolvedValueOnce(output);
    resourceSet.hasResource.mockResolvedValueOnce(true);
    await expect(extractor.handle(input)).resolves.toStrictEqual(output);
    expect(strategy.isRootContainer).toHaveBeenCalledTimes(0);
  });

  it('replaces create resources that do not exist with the first existing parent.', async(): Promise<void> => {
    const output: AccessMap = new IdentifierSetMultiMap<AccessMode>([
      [{ path: 'foo/bar/baz' }, new Set([AccessMode.create])],
      [{ path: 'foo/bar/bazz' }, new Set([AccessMode.create, AccessMode.read])],
      [{ path: 'foo/bar' }, new Set([AccessMode.write])],
      [{ path: 'oof' }, new Set([AccessMode.read])],
    ]);

    source.handle.mockResolvedValueOnce(output);
    strategy.isRootContainer.mockImplementation((id) => !id.path.includes('/'));
    strategy.getParentContainer.mockImplementation((id) => ({ path: id.path.slice(0, id.path.lastIndexOf('/')) }));
    resourceSet.hasResource.mockImplementation(async(id) => !id.path.includes('/'));

    const result = await extractor.handle(input);
    expect([...result.distinctKeys()]).toHaveLength(3);
    expect([...result.get({ path: 'foo' })!]).toEqual([ AccessMode.create ]);
    expect([...result.get({ path: 'foo/bar' })!]).toEqual([ AccessMode.write ]);
    expect([...result.get({ path: 'oof' })!]).toEqual([ AccessMode.read ]);
  });
});
