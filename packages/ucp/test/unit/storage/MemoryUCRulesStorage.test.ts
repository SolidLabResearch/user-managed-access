import { Store } from 'n3';
import { MemoryUCRulesStorage } from '../../../src/storage/MemoryUCRulesStorage'
import { turtleStringToStore } from '../../../src/util/Conversion';
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
        policy = await turtleStringToStore(policyString)
    })

    describe('when getting all rules', () => {
        it('returns an empty N3 Store when no rules are added.', async () => {
            const store = await storage.getStore();
            expect(store.size).toBe(0);
        })

        it('returns every triple that was added to the storage.', async () => {
            await storage.addRule(policy);
            const store = await storage.getStore();
            expect(store).toBeRdfIsomorphic(policy);
        })
    })

    describe('when adding a rule', () => {
        it('successfully adds a rule.', async () => {
            // should actually look into the store of the class. Can't do that right now
            const result = await storage.addRule(policy)
            expect(result).toBeUndefined();
        })
    })

    describe('when getting a rule', () => {
        it('returns empty N3 store when no such rule is present.', async () => {
            const store = await storage.getRule(ruleIRI);
            expect(store.size === 0);
        })

        it('returns the whole graph starting from the identifier given (thus also a rule).', async () => {
            await storage.addRule(policy)
            const store = await storage.getRule(ruleIRI);
            expect(store.size).toBe(5)
        })
    })

    describe('when deleting a rule', () => {
        // as I can not look into the store, this gets a little ugly. Reason being, I use other methods from the storage class to check correct behaviour of delete.
        it('deleleting an empty storage does nothing.', async () => {
            // tho it runs and doesn't error.
            const result = await storage.deleteRule(ruleIRI);
            expect(result).toBeUndefined();
        })

        it('successfully deletes a rule.', async () => {
            await storage.addRule(policy);
            await storage.deleteRule(ruleIRI);
            const ruleStore = await storage.getRule(ruleIRI);
            expect(ruleStore.size === 0);
            const store = await storage.getStore();
            expect(store.size).toBe(2)
        })
    })
})