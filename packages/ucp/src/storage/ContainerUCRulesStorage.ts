import { Store, Writer } from 'n3';
import { UCRulesStorage } from "./UCRulesStorage";
import { isRDFContentType, rdfToStore, storeToString, turtleStringToStore } from "../util/Conversion";
import { extractQuadsRecursive } from "../util/Util";

export type RequestInfo = string | Request;

// TODO: undo the container creation part again
export class ContainerUCRulesStorage implements UCRulesStorage {
    protected readonly containerURL: string;
    protected readonly fetch: (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>;
    // The resource that will be used to store the additional triples that will be added through this store
    protected extraDataUrl?: string;
    // Check if the container already exists if this is false and create it if it is not
    protected containerExists = false;

    /**
     *
     * @param containerURL The URL to an LDP container
     */
    public constructor(containerURL: string, customFetch?: (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>) {
        this.containerURL = containerURL
        console.log(`[${new Date().toISOString()}] - ContainerUCRulesStore: LDP Container that will be used as source for the Usage Control Rules`, this.containerURL);
        this.fetch = customFetch ?? fetch;
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
        await this.verifyContainer();
        const ruleString = storeToString(rule);

        let response = this.extraDataUrl ?
          await fetch(this.extraDataUrl, {
            method: 'PATCH',
            headers: { 'content-type': 'text/n3' },
            body: `
                @prefix solid: <http://www.w3.org/ns/solid/terms#>.
                
                _:rename a solid:InsertDeletePatch;
                  solid:inserts {
                    ${ruleString}
                  }.`,
            }) :
          // TODO: always just use PATCH, generate UUID on this side, will make many things easier
          await this.fetch(this.containerURL,{
              method: 'POST',
              headers: { 'content-type': 'text/turtle' },
              body: ruleString
          });
        if (response.status >= 400) {
            // TODO: better logging format
            console.log(ruleString);
            throw Error(`Above rule could not be added to the store ${response.status} ${await response.text()}`);
        }
        this.extraDataUrl = response.headers.get('location') as string;
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
        await this.verifyContainer();
        const documents = await this.getDocuments();
        // Find documents with matches, remove the triples and update the resource
        // TODO: instead: still find the documents, but use patch to update them to prevent conflicts
        for (const [ url, store ] of Object.entries(documents)) {
            let updated = false;
            for (const quad of data) {
                if (store.has(quad)) {
                    updated = true;
                    store.removeQuad(quad);
                }
            }
            if (updated) {
                const newBody = storeToString(store);
                const response = await this.fetch(url, {
                    method: 'PUT',
                    headers: { 'content-type': 'text/turtle' },
                    body: newBody,
                });
                if (response.status >= 400) {
                    throw Error(`Could not update rule resource ${url}`);
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

    protected async verifyContainer(): Promise<void> {
        if (this.containerExists) {
            return;
        }

        const response = await fetch(this.containerURL);
        if (response.status < 400) {
            this.containerExists = true;
            return;
        }
        if (response.status === 404) {
            const createResponse = await this.fetch(
              this.containerURL,
              { method: 'PUT', headers: { 'content-type': 'text/turtle' } }
            );
            if (createResponse.status !== 201) {
                throw new Error(`Unable to create ${this.containerURL}: ${await response.text()}`)
            }
            this.containerExists = true;
        }

        throw new Error(`Unable to access ${this.containerURL}: ${await response.text()}`);
    }

    protected async readLdpRDFResource(resourceURL: string): Promise<Store> {
        await this.verifyContainer();
        const containerResponse = await this.fetch(resourceURL, { headers: { 'accept': 'text/turtle' } });

        // TODO: here and other places: in case of 404 create the container
        if (containerResponse.status !== 200) {
            throw new Error(`Resource not found: ${resourceURL}`);
        }

        if (containerResponse.headers.get('content-type') !== 'text/turtle') { // note: should be all kinds of RDF, not only turtle
            throw new Error('Works only on rdf data');
        }
        const text = await containerResponse.text();
        return await turtleStringToStore(text, resourceURL);
    }
}
