import type { FetchParams, Fetcher } from './Fetcher';

/**
 * A simple {@link Fetcher} relying on fetch.
 */
export class BaseFetcher implements Fetcher {
  fetch(...args: FetchParams): Promise<Response> { return fetch(...args) }
}
