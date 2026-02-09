import 'jest-rdf';
import {
  BadRequestHttpError,
  ForbiddenHttpError,
  KeyValueStorage,
  NotFoundHttpError,
  RDF
} from '@solid/community-server';
import { Parser, Store } from 'n3';
import { ODRL } from 'odrl-evaluator';
import { Mocked } from 'vitest';
import { AccessRequestController } from '../../../src/controller/AccessRequestController';
import { UCRulesStorage } from '../../../src/ucp/storage/UCRulesStorage';
import { SOTW } from '../../../src/ucp/util/Vocabularies';

describe('AccessRequestController', (): void => {
  const target = 'http://example.org/resource_id';
  const scopes = [ 'http://example.org/scope1', 'http://example.org/scope2' ];
  const entity = 'entityID';
  const client = 'http://example.org/client';
  const owner = 'http://example.org/owner';
  let quads: Store;
  let store: Mocked<UCRulesStorage>;
  let ownershipStore: Mocked<KeyValueStorage<string, string[]>>;
  let controller: AccessRequestController;

  beforeEach(async(): Promise<void> => {
    quads = new Store(new Parser().parse(`
        @prefix sotw: <https://w3id.org/force/sotw#> .
        @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
        <http://example.org/request1> a sotw:EvaluationRequest ;
          sotw:requestedTarget <http://example.org/resource_id1> ;
          sotw:requestingParty <${client}> ;
          sotw:requestStatus sotw:requested ;
          sotw:requestedAction <${scopes[0]}> , <${scopes[1]}> .
        
        <http://example.org/request2> a sotw:EvaluationRequest ;
          sotw:requestedTarget <http://example.org/resource_id2> ;
          sotw:requestingParty <http://example.org/unknown> ;
          sotw:requestStatus sotw:requested ;
          sotw:requestedAction <${scopes[1]}> ;
          odrl:constraint [
            a odrl:Constraint ;
            odrl:leftOperand odrl:purpose ;
            odrl:operator odrl:eq ;
            odrl:rightOperand <http://example.org/purpose> 
          ] .
      `));

    store = {
      addRule: vi.fn(async(data: Store) => quads.addQuads(data.getQuads(null, null, null, null))),
      getStore: vi.fn().mockResolvedValue(new Store(quads)),
      removeData: vi.fn(async(data: Store) => quads.removeQuads(data.getQuads(null, null, null, null))),
    } satisfies Partial<UCRulesStorage> as any;

    ownershipStore = {
      get: vi.fn(),
    } satisfies Partial<KeyValueStorage<string, string[]>> as any;

    controller = new AccessRequestController(store, ownershipStore);
  });

  it('errors when trying to delete a request.', async(): Promise<void> => {
    await expect(controller.deleteEntity(entity, client)).rejects.toThrow(ForbiddenHttpError);
  });

  it('errors when trying to replace a request.', async(): Promise<void> => {
    await expect(controller.putEntity('data', entity, client)).rejects.toThrow(ForbiddenHttpError);
  });

  describe('#addEntity', (): void => {
    it('can add a request.', async(): Promise<void> => {
      const data = JSON.stringify({ resource_id: target, resource_scopes: scopes });

      const response = await controller.addEntity(data, client);
      expect(response.status).toBe(201);
      expect(store.addRule).toHaveBeenCalledTimes(1);

      const request = store.addRule.mock.calls[0][0];
      const expected = new Parser().parse(`
        @prefix sotw: <https://w3id.org/force/sotw#> .
        <${response.id}> a sotw:EvaluationRequest ;
          sotw:requestedTarget <${target}> ;
          sotw:requestingParty <${client}> ;
          sotw:requestStatus sotw:requested ;
          sotw:requestedAction <${scopes[0]}> , <${scopes[1]}> .
      `);
      expect(request).toBeRdfIsomorphic(expected);
    });

    it('can add a request with constraints.', async(): Promise<void> => {
      const data = JSON.stringify({
        resource_id: target,
        resource_scopes: scopes,
        constraints: [
          [ 'http://www.w3.org/ns/odrl/2/purpose', 'http://www.w3.org/ns/odrl/2/eq', 'http://example.org/purpose' ],
        ],
      });

      const response = await controller.addEntity(data, client);
      expect(response.status).toBe(201);
      expect(store.addRule).toHaveBeenCalledTimes(1);

      const request = store.addRule.mock.calls[0][0];
      const expected = new Parser().parse(`
        @prefix sotw: <https://w3id.org/force/sotw#> .
        @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
        <${response.id}> a sotw:EvaluationRequest ;
          sotw:requestedTarget <${target}> ;
          sotw:requestingParty <${client}> ;
          sotw:requestStatus sotw:requested ;
          sotw:requestedAction <${scopes[0]}> , <${scopes[1]}> ;
          odrl:constraint <${response.id}-constraint-1> .
        <${response.id}-constraint-1> a odrl:Constraint ;
          odrl:leftOperand odrl:purpose ;
          odrl:operator odrl:eq ;
          odrl:rightOperand <http://example.org/purpose> .
      `);
      expect(request).toBeRdfIsomorphic(expected);
    });
  });

  describe('#getEntities', (): void => {
    it('returns all requests where the user requested.', async(): Promise<void> => {
      const response = await controller.getEntities(client);
      expect(response.status).toBe(200);
      expect(new Parser().parse(response.message)).toBeRdfIsomorphic(new Parser().parse(`
        @prefix sotw: <https://w3id.org/force/sotw#> .
        @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
        <http://example.org/request1> a sotw:EvaluationRequest ;
          sotw:requestedTarget <http://example.org/resource_id1> ;
          sotw:requestingParty <${client}> ;
          sotw:requestStatus sotw:requested ;
          sotw:requestedAction <${scopes[0]}> , <${scopes[1]}> .
      `));
      expect(ownershipStore.get).toHaveBeenCalledExactlyOnceWith(client);
    });

    it('returns all requests where the user is the owner of the target resource.', async(): Promise<void> => {
      ownershipStore.get.mockResolvedValueOnce([ 'http://example.org/resource_id2' ]);
      const response = await controller.getEntities(owner);
      expect(response.status).toBe(200);
      expect(new Parser().parse(response.message)).toBeRdfIsomorphic(new Parser().parse(`
        @prefix sotw: <https://w3id.org/force/sotw#> .
        @prefix odrl: <http://www.w3.org/ns/odrl/2/> .        
        <http://example.org/request2> a sotw:EvaluationRequest ;
          sotw:requestedTarget <http://example.org/resource_id2> ;
          sotw:requestingParty <http://example.org/unknown> ;
          sotw:requestStatus sotw:requested ;
          sotw:requestedAction <${scopes[1]}> ;
          odrl:constraint [
            a odrl:Constraint ;
            odrl:leftOperand odrl:purpose ;
            odrl:operator odrl:eq ;
            odrl:rightOperand <http://example.org/purpose> 
          ] .
      `));
      expect(ownershipStore.get).toHaveBeenCalledExactlyOnceWith(owner);
    });

    it('returns nothing if there is no match.', async(): Promise<void> => {
      await expect(controller.getEntities(owner)).resolves.toEqual({ status: 200, message: '' });
    });
  });

  describe('#getEntity', (): void => {
    it('returns the requested entity if the client is the requester.', async(): Promise<void> => {
      const response = await controller.getEntity('http://example.org/request1', client);
      expect(response.status).toBe(200);
      expect(new Parser().parse(response.message)).toBeRdfIsomorphic(new Parser().parse(`
        @prefix sotw: <https://w3id.org/force/sotw#> .
        @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
        <http://example.org/request1> a sotw:EvaluationRequest ;
          sotw:requestedTarget <http://example.org/resource_id1> ;
          sotw:requestingParty <${client}> ;
          sotw:requestStatus sotw:requested ;
          sotw:requestedAction <${scopes[0]}> , <${scopes[1]}> .
      `));
    });

    it('returns the requested entity if the client is the owner of the target.', async(): Promise<void> => {
      ownershipStore.get.mockResolvedValueOnce([ 'http://example.org/resource_id2' ]);
      const response = await controller.getEntity('http://example.org/request2', owner);
      expect(response.status).toBe(200);
      expect(new Parser().parse(response.message)).toBeRdfIsomorphic(new Parser().parse(`
        @prefix sotw: <https://w3id.org/force/sotw#> .
        @prefix odrl: <http://www.w3.org/ns/odrl/2/> .        
        <http://example.org/request2> a sotw:EvaluationRequest ;
          sotw:requestedTarget <http://example.org/resource_id2> ;
          sotw:requestingParty <http://example.org/unknown> ;
          sotw:requestStatus sotw:requested ;
          sotw:requestedAction <${scopes[1]}> ;
          odrl:constraint [
            a odrl:Constraint ;
            odrl:leftOperand odrl:purpose ;
            odrl:operator odrl:eq ;
            odrl:rightOperand <http://example.org/purpose> 
          ] .
      `));
    });

    it('returns a 404 if no request is known with that identifier.', async(): Promise<void> => {
      await expect(controller.getEntity('http://example.org/unknown', client)).rejects.toThrow(NotFoundHttpError);
    });

    it('returns a 403 if the client is not allowed to see the resource.', async(): Promise<void> => {
      await expect(controller.getEntity('http://example.org/request1', owner)).rejects.toThrow(ForbiddenHttpError);
    });
  });

  // TODO: not testing with isolation as there are weird issues there
  describe('#patchEntity', (): void => {
    beforeEach(async(): Promise<void> => {
      // Mocking once not sufficient since the BaseController calls getEntity multiple times as well
      ownershipStore.get.mockResolvedValue([ 'http://example.org/resource_id2' ]);
    });

    it('creates a policy if the request is accepted.', async(): Promise<void> => {
      await expect(controller.patchEntity('http://example.org/request2', 'accepted', owner, false))
        .resolves.toEqual({ status: 204, body: '' });
      expect(quads.countQuads('http://example.org/request2', SOTW.terms.requestStatus, SOTW.terms.requested, null))
        .toBe(0);
      expect(quads.countQuads('http://example.org/request2', SOTW.terms.requestStatus, SOTW.terms.accepted, null))
        .toBe(1);
      const policies = quads.getSubjects(RDF.terms.type, ODRL.terms.Agreement, null);
      expect(policies).toHaveLength(1);
      const permissions = quads.getObjects(policies[0], ODRL.terms.permission, null);
      expect(permissions).toHaveLength(1);
      const constraints = quads.getObjects(permissions[0], ODRL.terms.constraint, null);
      expect(constraints).toHaveLength(1);
      expect(quads.getQuads(policies[0], null, null, null)).toBeRdfIsomorphic(new Parser().parse(`
        @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
        <${policies[0].value}> a odrl:Agreement ;
          odrl:uid <${policies[0].value}> ;
          odrl:permission <${permissions[0].value}> .
      `));
      expect(quads.getQuads(permissions[0], null, null, null)).toBeRdfIsomorphic(new Parser().parse(`
        @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
        <${permissions[0].value}> a odrl:Permission ;
          odrl:target <http://example.org/resource_id2> ;
          odrl:action <http://example.org/scope2> ;
          odrl:assignee <http://example.org/unknown> ;
          odrl:assigner <${owner}> ;
          odrl:constraint _:${constraints[0].value} .
      `));
      expect(quads.getQuads(constraints[0], null, null, null)).toBeRdfIsomorphic(new Parser().parse(`
        @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
        _:${constraints[0].value} a odrl:Constraint ;
          odrl:leftOperand odrl:purpose ;
          odrl:operator odrl:eq ;
          odrl:rightOperand <http://example.org/purpose> .
      `));
    });

    it('returns a 404 if the request is not known.', async(): Promise<void> => {
      await expect(controller.patchEntity('http://example.org/unknown', 'accepted', owner, false))
        .rejects.toThrow(NotFoundHttpError);
    });

    it('errors if the user is not the owner.', async(): Promise<void> => {
      ownershipStore.get.mockResolvedValue([]);
      await expect(controller.patchEntity('http://example.org/request2', 'accepted', owner, false))
        .rejects.toThrow(ForbiddenHttpError);
    });

    it('errors if an unknown state is provided.', async(): Promise<void> => {
      await expect(controller.patchEntity('http://example.org/request2', 'unknown', owner, false))
        .rejects.toThrow(BadRequestHttpError);
    });

    it('errors if the request has no actions.', async(): Promise<void> => {
      store.getStore.mockResolvedValueOnce(new Store(new Parser().parse(`
        @prefix sotw: <https://w3id.org/force/sotw#> .
        @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
        <http://example.org/request2> a sotw:EvaluationRequest ;
          sotw:requestedTarget <http://example.org/resource_id2> ;
          sotw:requestingParty <${client}> ;
          sotw:requestStatus sotw:requested .
      `)));
      await expect(controller.patchEntity('http://example.org/request2', 'accepted', owner, false))
        .rejects.toThrow(`Invalid actions () or parties (${client})`);
    });

    it('errors if the request has no requester.', async(): Promise<void> => {
      store.getStore.mockResolvedValueOnce(new Store(new Parser().parse(`
        @prefix sotw: <https://w3id.org/force/sotw#> .
        @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
        <http://example.org/request2> a sotw:EvaluationRequest ;
          sotw:requestedTarget <http://example.org/resource_id2> ;
          sotw:requestedAction <${scopes[1]}> ;
          sotw:requestStatus sotw:requested .
      `)));
      await expect(controller.patchEntity('http://example.org/request2', 'accepted', owner, false))
        .rejects.toThrow(`Invalid actions (http://example.org/scope2) or parties ()`);
    });
  });
});
