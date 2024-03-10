
/**
 * Shorthand for the parameters type of the Fetch API.
 */
export type FetchParams = Parameters<typeof fetch>;

/**
 * Any object implementing a fetch method adhering to the Fetch API signature.
 */
export interface Fetcher {
  fetch(...args: FetchParams): Promise<Response>;
};
