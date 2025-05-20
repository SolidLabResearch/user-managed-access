import type { Quad } from '@rdfjs/types';
import { Store, Writer } from 'n3';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { storeToString, turtleStringToStore } from '../util/Conversion';
import { extractQuadsRecursive } from '../util/Util';
import { UCRulesStorage } from './UCRulesStorage';

export type RequestInfo = string | Request;

export class ContainerUCRulesStorage implements UCRulesStorage {
    protected readonly containerURL: string;
    protected readonly fetch: (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>;
    // The resource that will be used to store the additional triples that will be added through this store
    protected readonly extraDataUrl: string;

    /**
     *
     * @param containerURL The URL to an LDP container
     */
    public constructor(
      containerURL: string,
      customFetch?: (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>
    ) {
        this.containerURL = containerURL;
        this.fetch = customFetch ?? fetch;
        this.extraDataUrl = path.posix.join(containerURL, randomUUID());
    }

    public async getStore(): Promise<Store> {
        // TODO: can use last-modified date/etag or something to cache store?
        const store = new Store()
        const documents = await this.getDocuments();
        for (const childStore of Object.values(documents)) {
            store.addQuads(childStore.getQuads(null, null, null, null));
        }
        return store;
    }

    public async addRule(rule: Store): Promise<void> {
        if (rule.size === 0) {
            return;
        }
        const ruleString = storeToString(rule);

        let response = await fetch(this.extraDataUrl, {
            method: 'PATCH',
            headers: { 'content-type': 'text/n3' },
            body: `
                @prefix solid: <http://www.w3.org/ns/solid/terms#>.
                
                _:rename a solid:InsertDeletePatch;
                  solid:inserts {
                    ${ruleString}
                  }.`,
            });
        if (response.status >= 400) {
            throw Error(`Could not add rule to the storage ${response.status} ${await response.text()}`);
        }
    }

    public async getRule(identifier: string): Promise<Store> {
        // would be better if there was a cache <ruleID, ldp:resource>
        const allRules = await this.getStore()
        const rule = extractQuadsRecursive(allRules, identifier);
        return rule
    }

    public async deleteRule(identifier: string): Promise<void> {
        // would really benefit from a cache <ruleID, ldp:resource>
        throw Error('not implemented');
    }

    public async removeData(data: Store): Promise<void> {
        if (data.size === 0) {
            return;
        }
        const documents = await this.getDocuments();
        // Remove matches from documents that contain them
        for (const [ url, store ] of Object.entries(documents)) {
            const matches: Quad[] = [];
            for (const quad of data) {
                if (store.has(quad)) {
                    matches.push(quad);
                }
            }
            if (matches.length > 0) {
                const response = await this.fetch(url, {
                    method: 'PUT',
                    headers: { 'content-type': 'text/n3' },
                    body: `
                @prefix solid: <http://www.w3.org/ns/solid/terms#>.
                
                _:rename a solid:InsertDeletePatch;
                  solid:deletes {
                    ${new Writer().quadsToString(matches)}
                  }.`,
                });

                if (response.status >= 400) {
                    throw Error(`Could not update rule resource ${url}: ${response.status} - ${await response.text()}`);
                }
            }
        }
    }

    /**
     * Returns all documents containing triples in the stored container.
     */
    protected async getDocuments(): Promise<Record<string, Store>> {
        const result: Record<string, Store> = {};
        const container = await this.readLdpRDFResource(this.containerURL);
        const children = container.getObjects(this.containerURL, "http://www.w3.org/ns/ldp#contains", null).map(value => value.value)
        for (const childURL of children) {
            try {
                result[childURL] = await this.readLdpRDFResource(childURL);
            } catch (e) {
                console.log(`${childURL} is not an RDF resource`);
            }
        }
        return result;
    }

    protected async readLdpRDFResource(resourceURL: string): Promise<Store> {
        const containerResponse = await this.fetch(resourceURL, { headers: { 'accept': 'text/turtle' } });

        if (containerResponse.status === 404) {
            return new Store();
        }

        if (containerResponse.status !== 200) {
            throw new Error(`Unable to acces policy container ${resourceURL}: ${
                containerResponse.status} - ${await containerResponse.text()}`);
        }

        const contentType = containerResponse.headers.get('content-type');
        // TODO: support non-turtle formats
        if (contentType !== 'text/turtle') {
            throw new Error(`Only turtle serialization is supported, received ${contentType}`);
        }
        const text = await containerResponse.text();
        return await turtleStringToStore(text, resourceURL);
    }
}
