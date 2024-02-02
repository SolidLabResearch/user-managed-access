import { Store } from "n3";
import { extractQuadsRecursive } from "../util/Util";
import { UCRulesStorage } from "./UCRulesStorage";

export class MemoryUCRulesStorage implements UCRulesStorage {
    private store: Store;

    public constructor() {
        this.store = new Store();
    }

    public async getStore(): Promise<Store> {
        return this.store;
    }


    public async addRule(rule: Store): Promise<void> {
        this.store.addQuads(rule.getQuads(null, null, null, null))
    }

    public async getRule(identifier: string): Promise<Store> {
        // currently doesn't check whether it is actually an odrl:rule
        return extractQuadsRecursive(this.store, identifier)
    }

    public async deleteRule(identifier: string): Promise<void> {
        const store = await this.getRule(identifier)
        this.store.removeQuads(store.getQuads(null, null, null, null));
    }
}