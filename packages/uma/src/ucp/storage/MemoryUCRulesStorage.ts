import { DataFactory, Store } from 'n3';
import { extractQuadsRecursive } from '../util/Util';
import { ReadOnlyStore, UCRulesStorage } from './UCRulesStorage';

const { namedNode } = DataFactory;

export class MemoryUCRulesStorage implements UCRulesStorage {
    protected store: Store;

    public constructor() {
        this.store = new Store();
    }

    public async getStore(): Promise<ReadOnlyStore> {
        return this.store;
    }


    public async addRule(rule: ReadOnlyStore): Promise<void> {
        this.store.addQuads(rule.getQuads(null, null, null, null))
    }

    public async getRule(identifier: string): Promise<ReadOnlyStore> {
        // currently doesn't check whether it is actually an odrl:rule
        return extractQuadsRecursive(this.store, identifier)
    }

    public async deleteRule(identifier: string): Promise<void> {
        const store = await this.getRule(identifier)
        this.store.removeQuads(store.getQuads(null, null, null, null));
    }

    public async deleteRuleFromPolicy(ruleID: string, PolicyID: string) {
        // Delete the rule and its definition in the policy
        this.store.getQuads(namedNode(PolicyID), null, namedNode(ruleID), null).forEach(quad => this.store.delete(quad));
        this.deleteRule(ruleID);
    }

    public async removeData(data: ReadOnlyStore): Promise<void> {
        this.store.removeQuads(data.getQuads(null, null, null, null));
    }
}
