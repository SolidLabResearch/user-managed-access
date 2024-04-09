import { getLoggerFor } from '@solid/community-server';
import type { FetchParams, Fetcher } from './Fetcher';
import retryFetcher from 'fetch-retry';

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
