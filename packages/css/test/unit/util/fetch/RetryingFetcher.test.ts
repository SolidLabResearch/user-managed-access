import { Mocked } from 'vitest';
import { Fetcher } from '../../../../src/util/fetch/Fetcher';
import { RetryingFetcher } from '../../../../src/util/fetch/RetryingFetcher';

describe('RetryingFetcher', (): void => {
  let source: Mocked<Fetcher>;
  let fetcher: RetryingFetcher;

  beforeEach(async(): Promise<void> => {
    source = {
      fetch: vi.fn().mockResolvedValue({ status: 200 }),
    }
    fetcher = new RetryingFetcher(source, 150, 3, [ 503 ]);
  });

  it('performs the request if there was no error.', async(): Promise<void> => {
    await expect(fetcher.fetch('http://example.com/', { method: 'DELETE' })).resolves.toEqual({ status: 200 });
    expect(source.fetch).toHaveBeenCalledTimes(1);
    expect(source.fetch).toHaveBeenLastCalledWith('http://example.com/', { method: 'DELETE' });
  });

  it('retries if there was a an invalid response.', async(): Promise<void> => {
    source.fetch.mockResolvedValueOnce({ status: 503 } as any);
    await expect(fetcher.fetch('http://example.com/', { method: 'DELETE' })).resolves.toEqual({ status: 200 });
    expect(source.fetch).toHaveBeenCalledTimes(2);
    expect(source.fetch).toHaveBeenNthCalledWith(1, 'http://example.com/', { method: 'DELETE' });
    expect(source.fetch).toHaveBeenNthCalledWith(2, 'http://example.com/', { method: 'DELETE' });
  });
});
