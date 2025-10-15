import retryFetcher from 'fetch-retry';
import { getLoggerFor } from 'global-logger-factory';
import type { Fetcher, FetchParams } from './Fetcher';

/**
 * A {@link Fetcher} wrapper that retries failed fetches.
 */
export class RetryingFetcher implements Fetcher {
  protected readonly logger = getLoggerFor(this);
  protected readonly retryFetch: (...args: FetchParams) => Promise<Response>;

  constructor(
    protected fetcher: Fetcher,
    retries: number = 150,
    exponent: number = 3,
    retryOn: number[] = [],
  ) {
    this.retryFetch = retryFetcher(fetcher.fetch.bind(fetcher), {
      retryOn,
      retries,
      retryDelay: (attempt) => Math.pow(exponent, attempt) * 1000,
    });
  }

  async fetch(...args: FetchParams): Promise<Response> {
    return this.retryFetch(...args)
  }
}
