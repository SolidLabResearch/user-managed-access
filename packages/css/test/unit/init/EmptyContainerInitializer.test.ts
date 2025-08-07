import { Mocked } from 'vitest';
import { EmptyContainerInitializer } from '../../../src/init/EmptyContainerInitializer';
import { BasicRepresentation, ResourceStore } from '@solid/community-server';

describe('EmptyContainerInitializer', (): void => {
  const baseUrl = 'http://example.com/';
  const container = 'foo/';
  let store: Mocked<ResourceStore>;
  let initializer: EmptyContainerInitializer;

  beforeEach(async(): Promise<void> => {
    store = {
      hasResource: vi.fn(),
      setRepresentation: vi.fn(),
    } satisfies Partial<ResourceStore> as any;

    initializer = new EmptyContainerInitializer(baseUrl, container, store);
  });

  it('errors if the input container does not end with a slash.', async(): Promise<void> => {
    expect(() => new EmptyContainerInitializer(baseUrl, 'foo', store))
      .toThrow('Container paths should end with a slash, instead got foo');
  });

  it('does nothing if the container already exists.', async(): Promise<void> => {
    store.hasResource.mockResolvedValueOnce(true);
    await expect(initializer.handle()).resolves.toBeUndefined();
    expect(store.setRepresentation).toHaveBeenCalledTimes(0);
  });

  it('creates the container if it does not exist yet.', async(): Promise<void> => {
    store.hasResource.mockResolvedValueOnce(false);
    await expect(initializer.handle()).resolves.toBeUndefined();
    expect(store.setRepresentation).toHaveBeenCalledTimes(1);
    expect(store.setRepresentation.mock.calls[0][0].path).toBe('http://example.com/foo/');
    expect(store.setRepresentation.mock.calls[0][1].isEmpty).toBe(true);
  });
});
