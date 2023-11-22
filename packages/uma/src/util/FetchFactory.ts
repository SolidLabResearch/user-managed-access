import {fetch} from 'cross-fetch';

/**
 * Factory class yielding an authenticated fetch
 * for accessing some resource
 */
export abstract class FetchFactory {
    abstract getAuthenticatedFetch(clientId: string): typeof fetch;
}
