import { Mocked } from 'vitest';
import { flushPromises } from '../../../../../../test/util/Util';
import { Fetcher } from '../../../../src/util/fetch/Fetcher';
import { PausableFetcher } from '../../../../src/util/fetch/PausableFetcher';

describe('PausableFetcher', (): void => {
  let source: Mocked<Fetcher>;
  let fetcher: PausableFetcher;

  beforeEach(async(): Promise<void> => {
    source = {
      fetch: vi.fn().mockResolvedValue('result'),
    };

    fetcher = new PausableFetcher(source);
  });

  it('does nothing until it is unpaused.', async(): Promise<void> => {
    const prom = fetcher.fetch('http://example.com/', { method: 'DELETE' });
    await flushPromises();
    expect(source.fetch).toHaveBeenCalledTimes(0);
    await fetcher.changeStatus(true);
    await flushPromises();
    expect(source.fetch).toHaveBeenCalledTimes(1);
    expect(source.fetch).toHaveBeenLastCalledWith('http://example.com/', { method: 'DELETE' });
    await expect(prom).resolves.toBe('result');
  });
});
