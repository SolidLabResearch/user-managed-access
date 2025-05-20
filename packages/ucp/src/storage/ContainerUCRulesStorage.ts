import { Store } from "n3";
import { UCRulesStorage } from "./UCRulesStorage";
import { storeToString, turtleStringToStore } from "../util/Conversion";
import { extractQuadsRecursive } from "../util/Util";

export type RequestInfo = string | Request;

export class ContainerUCRulesStorage implements UCRulesStorage {
    private containerURL: string;
    private fetch: (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>;
    // The resource that will be used to store the additional triples that will be added through this store
    private extraDataUrl?: string;

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
        const store = new Store()
        const documents = await this.getDocuments();
        for (const childStore of Object.values(documents)) {
            store.addQuads(childStore.getQuads(null, null, null, null));
        }
        return store;
    }

    public async addRule(rule: Store): Promise<void> {
        const ruleString = storeToString(rule);
        const response = await this.fetch(this.extraDataUrl || this.containerURL,{
            method: this.extraDataUrl ? 'PUT' : 'POST',
            headers: { 'content-type': 'text/turtle' },
            body: ruleString
        })
        if (response.status !== 201) {
            console.log(ruleString);
            throw Error("Above rule could not be added to the store")
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
        const documents = await this.getDocuments();
        // Find documents with matches, remove the triples and update the resource
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
        const container = await readLdpRDFResource(this.fetch, this.containerURL);
        const children = container.getObjects(this.containerURL, "http://www.w3.org/ns/ldp#contains", null).map(value => value.value)
        for (const childURL of children) {
            try {
                result[childURL] = await readLdpRDFResource(this.fetch, childURL);
            } catch (e) {
                console.log(`${childURL} is not an RDF resource`);
            }
        }
        return result;
    }
}

export async function readLdpRDFResource(fetch: (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>, resourceURL: string): Promise<Store> {
    const containerResponse = await fetch(resourceURL, { headers: { 'accept': 'text/turtle' } });

    if (containerResponse.status !== 200) {
        throw new Error(`Resource not found: ${resourceURL}`);
    }
    if (containerResponse.headers.get('content-type') !== 'text/turtle') { // note: should be all kinds of RDF, not only turtle
        throw new Error('Works only on rdf data');
    }
    const text = await containerResponse.text();
    return await turtleStringToStore(text, resourceURL);
}
