import { fetch as crossFetch } from 'cross-fetch';
import type { FetchParams, Fetcher } from './Fetcher';

/**
 * A simple {@link Fetcher} relying on cross-fetch.
 */
export class BaseFetcher implements Fetcher {
  fetch(...args: FetchParams): Promise<Response> { return crossFetch(...args) }
}
