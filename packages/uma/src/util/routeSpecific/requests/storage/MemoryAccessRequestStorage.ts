import { Store } from "n3";
import { AccessRequestStorage } from "./AccessRequestStorage";
import { QueryEngine } from "@comunica/query-sparql";

export class MemoryAccessRequestStorage implements AccessRequestStorage {

    private store: Store;

    public constructor() {
        this.store = new Store();
    }

    public getStore(): Store {
        return this.store;
    }
    
    public async addAccessRequest(request: Store): Promise<void> {
        this.store.addQuads(request.getQuads(null, null, null, null));
    }

    public async getAccessRequest(requester: string): Promise<Store> {
        const quads = this.store.getQuads(null, "https://w3id.org/force/sotw#requestingParty", requester, null); // TODO: change prefix by Vocabulary element
        return new Store(
            quads.flatMap((quad) => this.store.getQuads(quad.subject, null, null, null))
        );
    }

    // ! There is no query validation to check whether the received queries are of the right type
    // ! This is a potential security risk

    public async updateAccessRequest(query: string): Promise<void> {        
        try {
            await new QueryEngine().queryVoid(query, { sources: [this.getStore()] });
        } catch (error) {
            // throw new Error("Something went wrong during the processing of the query");
            throw error;
        }
    }
}
