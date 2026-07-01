import { RDF } from '@solid/community-server';
import { DataFactory, Store } from 'n3';
import { AccessRequestController } from '../../../src/controller/AccessRequestController';
import { ODRL } from '../../../src/ucp/util/Vocabularies';

const { namedNode } = DataFactory;

describe('AccessRequestController', (): void => {
  const requester = 'http://rs.local:3000/bob/profile/card#me';
  const target = 'urn:uuid:resource';

  it('creates access requests from a posted ticket id.', async(): Promise<void> => {
    const policyStore = new Store();
    const ticketStore = {
      get: vi.fn().mockResolvedValue({
        permissions: [{
          resource_id: target,
          resource_scopes: [
            'urn:example:css:modes:read',
            'urn:example:css:modes:write',
          ],
        }],
        required: [],
        provided: {},
      }),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new AccessRequestController({
      getStore: vi.fn().mockResolvedValue(policyStore),
      addRule: vi.fn(async(store: Store): Promise<void> => {
        policyStore.addAll(store);
      }),
    } as any, ticketStore as any);

    await expect(controller.addEntity(JSON.stringify({ ticket: 'ticket-id' }), requester))
      .resolves.toEqual({ status: 202, message: '' });

    const request = policyStore.getSubjects(
      RDF.terms.type,
      namedNode('https://w3id.org/force/sotw#EvaluationRequest'),
      null,
    )[0];
    expect(request).toBeDefined();
    expect(policyStore.countQuads(request, namedNode('https://w3id.org/force/sotw#requestedTarget'), namedNode(target), null)).toBe(1);
    expect(policyStore.countQuads(request, namedNode('https://w3id.org/force/sotw#requestingParty'), namedNode(requester), null)).toBe(1);
    expect(policyStore.countQuads(request, namedNode('https://w3id.org/force/sotw#requestedAction'), ODRL.terms.read, null)).toBe(1);
    expect(policyStore.countQuads(request, namedNode('https://w3id.org/force/sotw#requestedAction'), ODRL.terms.write, null)).toBe(1);
    expect(ticketStore.delete).toHaveBeenCalledWith('ticket-id');
  });

  it('returns 404 for an unknown ticket id.', async(): Promise<void> => {
    const controller = new AccessRequestController({
      getStore: vi.fn(),
      addRule: vi.fn(),
    } as any, {
      get: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
    } as any);

    await expect(controller.addEntity(JSON.stringify({ ticket: 'missing-ticket' }), requester))
      .resolves.toMatchObject({ status: 404 });
  });
});
