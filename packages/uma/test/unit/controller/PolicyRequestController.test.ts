import { KeyValueStorage } from '@solid/community-server';
import { Parser, Store } from 'n3';
import { Mocked } from 'vitest';
import { PolicyController } from '../../../src/controller/PolicyRequestController';
import { MemoryUCRulesStorage } from '../../../src/ucp/storage/MemoryUCRulesStorage';

describe('PolicyController', (): void => {
  const owner = 'http://rs.local:3000/alice/profile/card#me';
  const requester = 'http://rs.local:3000/bob/profile/card#me';
  const target = 'urn:uuid:resource';

  let rulesStorage: MemoryUCRulesStorage;
  let revocationStore: Mocked<KeyValueStorage<string, number>>;
  let controller: PolicyController;

  beforeEach(async(): Promise<void> => {
    rulesStorage = new MemoryUCRulesStorage();
    await rulesStorage.addRule(createPolicyStore());
    revocationStore = {
      set: vi.fn(),
    } satisfies Partial<KeyValueStorage<string, number>> as any;
    controller = new PolicyController(rulesStorage, revocationStore);
  });

  it('revokes tokens for the target resource when a policy permission changes.', async(): Promise<void> => {
    await expect(controller.patchEntity(undefined, `
      PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

      DELETE {
        <http://example.org/owner-rule> odrl:action odrl:read .
      } INSERT {
        <http://example.org/owner-rule> odrl:action odrl:write .
      } WHERE {
        <http://example.org/owner-rule> odrl:action odrl:read .
      }
    `, owner, false)).resolves.toEqual({ status: 204, message: '' });

    expect(revocationStore.set).toHaveBeenCalledTimes(1);
    expect(revocationStore.set).toHaveBeenLastCalledWith(target, expect.any(Number));
  });

  function createPolicyStore(): Store {
    return new Store(new Parser().parse(`
      @prefix odrl: <http://www.w3.org/ns/odrl/2/> .

      <http://example.org/owner-policy> a odrl:Agreement ;
        odrl:uid <http://example.org/owner-policy> ;
        odrl:permission <http://example.org/owner-rule> .

      <http://example.org/owner-rule> a odrl:Permission ;
        odrl:action odrl:read ;
        odrl:target <${target}> ;
        odrl:assignee <${requester}> ;
        odrl:assigner <${owner}> .
    `));
  }
});
