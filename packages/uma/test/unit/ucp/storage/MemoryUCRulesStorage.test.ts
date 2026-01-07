import { Parser, Store } from 'n3';
import { MemoryUCRulesStorage } from '../../../../src/ucp/storage/MemoryUCRulesStorage'
import "jest-rdf";

describe('A MemoryUCRulesStorage', () => {
    let storage: MemoryUCRulesStorage;
    const policyString = `
    <http://example.org/1705937573496#usagePolicy> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/odrl/2/Agreement> .
<http://example.org/1705937573496#usagePolicy> <http://www.w3.org/ns/odrl/2/permission> <http://example.org/1705937573496#permission> .
<http://example.org/1705937573496#permission> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/odrl/2/Permission> .
<http://example.org/1705937573496#permission> <http://www.w3.org/ns/odrl/2/action> <http://www.w3.org/ns/odrl/2/use> .
<http://example.org/1705937573496#permission> <http://www.w3.org/ns/odrl/2/target> <http://localhost:3000/test.ttl> .
<http://example.org/1705937573496#permission> <http://www.w3.org/ns/odrl/2/assignee> <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .
<http://example.org/1705937573496#permission> <http://www.w3.org/ns/odrl/2/assigner> <https://pod.woutslabbinck.com/profile/card#me> .`
    const ruleIRI = 'http://example.org/1705937573496#permission'
    let policy: Store;

    beforeEach(async () => {
        storage = new MemoryUCRulesStorage();
        policy = new Store(new Parser().parse(policyString));
    })

    it('returns an empty N3 Store when no rules are added.', async () => {
        const store = await storage.getStore();
        expect(store.size).toBe(0);
    });

    it('returns every triple that was added to the storage.', async () => {
        await expect(storage.addRule(policy)).resolves.toBeUndefined();
        const store = await storage.getStore();
        expect(store).toBeRdfIsomorphic(policy);
    });

    it('returns empty N3 store when no such rule is present.', async () => {
        const store = await storage.getRule(ruleIRI);
        expect(store.size).toBe(0);
    });

    it('returns the whole graph starting from the identifier given (thus also a rule).', async () => {
        await storage.addRule(policy);
        const store = await storage.getRule(ruleIRI);
        expect(store.size).toBe(5);
    });

    it('deleting an empty storage does nothing.', async () => {
        await expect(storage.deleteRule(ruleIRI)).resolves.toBeUndefined();
    })

    it('successfully deletes a rule.', async () => {
        await expect(storage.addRule(policy)).resolves.toBeUndefined();
        await expect(storage.deleteRule(ruleIRI)).resolves.toBeUndefined();
        const ruleStore = await storage.getRule(ruleIRI);
        expect(ruleStore.size).toBe(0);
        const store = await storage.getStore();
        expect(store.size).toBe(2)
    });

    it('can delete specific triples.', async(): Promise<void> => {
        await expect(storage.addRule(policy)).resolves.toBeUndefined();
        const data = new Parser().parse(
          '<http://example.org/1705937573496#permission> <http://www.w3.org/ns/odrl/2/assigner> <https://pod.woutslabbinck.com/profile/card#me>.',
        );
        await expect(storage.removeData(new Store(data))).resolves.toBeUndefined();
        const store = await storage.getStore();
        expect(store.size).toBe(6);
    });
});
