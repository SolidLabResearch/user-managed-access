import 'jest-rdf';
import {
  joinUrl,
  KeyValueStorage,
  MethodNotAllowedHttpError,
  NotFoundHttpError,
  RDF,
  UnauthorizedHttpError
} from '@solid/community-server';
import { ODRL, ODRL_P, OWL, UCRulesStorage } from '@solidlab/ucp';
import { DataFactory as DF, Store } from 'n3';
import { Mocked } from 'vitest';
import { ResourceRegistrationRequestHandler } from '../../../src/routes/ResourceRegistration';
import { HttpHandlerContext } from '../../../src/util/http/models/HttpHandler';
import * as signatures from '../../../src/util/HttpMessageSignatures';
import { ResourceDescription } from '../../../src/views/ResourceDescription';

vi.mock('../../../src/util/HttpMessageSignatures', async() => ({
  extractRequestSigner: vi.fn().mockResolvedValue('signer'),
  verifyRequest: vi.fn().mockResolvedValue(true),
}));

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(),
}));

describe('ResourceRegistration', (): void => {
  let input: HttpHandlerContext<ResourceDescription>;
  let policyStore: Store;

  let resourceStore: Mocked<KeyValueStorage<string, ResourceDescription>>;
  let policies: Mocked<UCRulesStorage>;

  let handler: ResourceRegistrationRequestHandler;

  beforeEach(async(): Promise<void> => {
    vi.clearAllMocks();

    input = { request: {
      url: new URL('http://example.com/foo'),
      method: 'GET',
      headers: {},
      body: {
        name: 'name',
        resource_scopes: [ 'scope1', 'scope2' ],
      }
    }};

    policyStore = new Store();

    resourceStore = {
      has: vi.fn().mockResolvedValue(false),
      set: vi.fn(),
      delete: vi.fn(),
    } satisfies Partial<KeyValueStorage<string, ResourceDescription>> as any;

    policies = {
      getStore: vi.fn().mockResolvedValue(policyStore),
      addRule: vi.fn(),
      removeData: vi.fn(),
    } satisfies Partial<UCRulesStorage> as any;

    handler = new ResourceRegistrationRequestHandler(resourceStore, policies);
  });

  it('errors if the request is not authorized.', async(): Promise<void> => {
    const verifyRequest = vi.spyOn(signatures, 'verifyRequest');
    verifyRequest.mockResolvedValueOnce(false);
    await expect(handler.handle(input)).rejects.toThrow(UnauthorizedHttpError);
    expect(verifyRequest).toHaveBeenCalledTimes(1);
    expect(verifyRequest).toHaveBeenLastCalledWith(input.request, 'signer');
  });

  it('throws an error if the method is not allowed.', async(): Promise<void> => {
    await expect(handler.handle(input)).rejects.toThrow(MethodNotAllowedHttpError);
  });

  describe('with POST requests', (): void => {
    beforeEach(async(): Promise<void> => {
      input.request.method = 'POST';
    });

    it('errors if the body syntax is wrong.', async(): Promise<void> => {
      (input.request.body as any).resource_scopes = 'apple';
      await expect(handler.handle(input)).rejects.toThrow('Request has bad syntax: value is not an array');
    });

    it('throws an error when trying to register a resource with a known name.', async(): Promise<void> => {
      resourceStore.has.mockResolvedValueOnce(true);
      await expect(handler.handle(input)).rejects
        .toThrow('A resource with name name is already registered. Use PUT to update existing registrations.');
      expect(resourceStore.has).toHaveBeenCalledTimes(1);
      expect(resourceStore.has).toHaveBeenLastCalledWith('name');
      expect(resourceStore.set).toHaveBeenCalledTimes(0);
    });

    it('registers the resource using the name as identifier.', async(): Promise<void> => {
      await expect(handler.handle(input)).resolves.toEqual({
        status: 201,
        headers: { location: `http://example.com/foo/name` },
        body: { _id: 'name', user_access_policy_uri: 'TODO: implement policy UI' },
      });
      expect(resourceStore.set).toHaveBeenCalledTimes(1);
      expect(resourceStore.set).lastCalledWith('name', input.request.body);
    });

    it('stores newly created asset collections.', async(): Promise<void> => {
      const crypto = await import('node:crypto');
      let count = 0;
      vi.mocked(crypto.randomUUID).mockImplementation(() => `${++count}` as any);
      input.request.body!.resource_defaults = { pred: [ 'scope' ], '@reverse': { 'rPred': [ 'otherScope' ]}};
      await expect(handler.handle(input)).resolves.toEqual({
        status: 201,
        headers: { location: `http://example.com/foo/name` },
        body: { _id: 'name', user_access_policy_uri: 'TODO: implement policy UI' },
      });
      expect(policies.addRule).toHaveBeenCalledTimes(1);
      const newStore = policies.addRule.mock.calls[0][0];
      expect(newStore).toBeRdfIsomorphic([
        DF.quad(DF.namedNode('collection:1'), RDF.terms.type, ODRL.terms.AssetCollection),
        DF.quad(DF.namedNode('collection:1'), ODRL.terms.source, DF.namedNode('name')),
        DF.quad(DF.namedNode('collection:1'), ODRL_P.terms.relation, DF.namedNode('pred')),
        DF.quad(DF.namedNode('collection:2'), RDF.terms.type, ODRL.terms.AssetCollection),
        DF.quad(DF.namedNode('collection:2'), ODRL.terms.source, DF.namedNode('name')),
        DF.quad(DF.namedNode('collection:2'), ODRL_P.terms.relation, DF.blankNode('n3-0')),
        DF.quad(DF.blankNode('n3-0'), OWL.terms.inverseOf, DF.namedNode('rPred')),
      ]);
    });

    it('errors when trying to register a relation when the collection does not exist.', async(): Promise<void> => {
      input.request.body!.resource_relations = { rPred: [ 'name' ] };
      await expect(handler.handle(input)).rejects
        .toThrow('Registering resource with relation rPred to name while there is no matching collection.');
    });

    it('stores the relation triples.', async(): Promise<void> => {
      policyStore.addQuads([
        DF.quad(DF.namedNode('collection:1'), RDF.terms.type, ODRL.terms.AssetCollection),
        DF.quad(DF.namedNode('collection:1'), ODRL.terms.source, DF.namedNode('name')),
        DF.quad(DF.namedNode('collection:1'), ODRL_P.terms.relation, DF.namedNode('pred')),
        DF.quad(DF.namedNode('collection:2'), RDF.terms.type, ODRL.terms.AssetCollection),
        DF.quad(DF.namedNode('collection:2'), ODRL.terms.source, DF.namedNode('name')),
        DF.quad(DF.namedNode('collection:2'), ODRL_P.terms.relation, DF.blankNode('n3-0')),
        DF.quad(DF.blankNode('n3-0'), OWL.terms.inverseOf, DF.namedNode('rPred')),
      ]);
      input.request.body!.resource_relations = { rPred: [ 'name' ], '@reverse': { pred: [ 'name' ] }};
      input.request.body!.name = 'entry';
      await expect(handler.handle(input)).resolves.toEqual({
        status: 201,
        headers: { location: `http://example.com/foo/entry` },
        body: { _id: 'entry', user_access_policy_uri: 'TODO: implement policy UI' },
      });
      expect(policies.addRule).toHaveBeenCalledTimes(1);
      const newStore = policies.addRule.mock.calls[0][0];
      expect(newStore).toBeRdfIsomorphic([
        DF.quad(DF.namedNode('entry'), ODRL.terms.partOf, DF.namedNode('collection:1')),
        DF.quad(DF.namedNode('entry'), ODRL.terms.partOf, DF.namedNode('collection:2')),
      ]);
    });
  });


  describe('with PUT requests', (): void => {
    beforeEach(async(): Promise<void> => {
      input.request.method = 'PUT';
      input.request.parameters = { id: 'name' };

      resourceStore.has.mockResolvedValue(true);
    });

    it('errors if no id parameter is provided.', async(): Promise<void> => {
      input.request.parameters = {};
      await expect(handler.handle(input)).rejects.toThrow('URI for PUT operation should include an id.');
    });

    it('errors if the resource is not known.', async(): Promise<void> => {
      resourceStore.has.mockResolvedValueOnce(false);
      await expect(handler.handle(input)).rejects.toThrow(NotFoundHttpError);
    });

    it('errors if the body syntax is wrong.', async(): Promise<void> => {
      (input.request.body as any).resource_scopes = 'apple';
      await expect(handler.handle(input)).rejects.toThrow('Request has bad syntax: value is not an array');
    });

    it('updates the resource metadata.', async(): Promise<void> => {
      await expect(handler.handle(input)).resolves.toEqual({
        status: 200,
        body: { _id: 'name', user_access_policy_uri: 'TODO: implement policy UI' },
      });
      expect(resourceStore.set).toHaveBeenCalledTimes(1);
      expect(resourceStore.set).lastCalledWith('name', input.request.body);
    });

    it('stores newly created asset collections.', async(): Promise<void> => {
      const crypto = await import('node:crypto');
      let count = 0;
      vi.mocked(crypto.randomUUID).mockImplementation(() => `${++count}` as any);
      input.request.body!.resource_defaults = { pred: [ 'scope' ], '@reverse': { 'rPred': [ 'otherScope' ]}};
      await expect(handler.handle(input)).resolves.toEqual({
        status: 200,
        body: { _id: 'name', user_access_policy_uri: 'TODO: implement policy UI' },
      });
      expect(policies.addRule).toHaveBeenCalledTimes(1);
      const newStore = policies.addRule.mock.calls[0][0];
      expect(newStore).toBeRdfIsomorphic([
        DF.quad(DF.namedNode('collection:1'), RDF.terms.type, ODRL.terms.AssetCollection),
        DF.quad(DF.namedNode('collection:1'), ODRL.terms.source, DF.namedNode('name')),
        DF.quad(DF.namedNode('collection:1'), ODRL_P.terms.relation, DF.namedNode('pred')),
        DF.quad(DF.namedNode('collection:2'), RDF.terms.type, ODRL.terms.AssetCollection),
        DF.quad(DF.namedNode('collection:2'), ODRL.terms.source, DF.namedNode('name')),
        DF.quad(DF.namedNode('collection:2'), ODRL_P.terms.relation, DF.blankNode('n3-0')),
        DF.quad(DF.blankNode('n3-0'), OWL.terms.inverseOf, DF.namedNode('rPred')),
      ]);
    });

    it('errors when trying to register a relation when the collection does not exist.', async(): Promise<void> => {
      input.request.body!.resource_relations = { rPred: [ 'name' ] };
      await expect(handler.handle(input)).rejects
        .toThrow('Registering resource with relation rPred to name while there is no matching collection.');
    });

    it('stores the relation triples.', async(): Promise<void> => {
      policyStore.addQuads([
        DF.quad(DF.namedNode('collection:1'), RDF.terms.type, ODRL.terms.AssetCollection),
        DF.quad(DF.namedNode('collection:1'), ODRL.terms.source, DF.namedNode('name')),
        DF.quad(DF.namedNode('collection:1'), ODRL_P.terms.relation, DF.namedNode('pred')),
        DF.quad(DF.namedNode('collection:2'), RDF.terms.type, ODRL.terms.AssetCollection),
        DF.quad(DF.namedNode('collection:2'), ODRL.terms.source, DF.namedNode('name')),
        DF.quad(DF.namedNode('collection:2'), ODRL_P.terms.relation, DF.blankNode('n3-0')),
        DF.quad(DF.blankNode('n3-0'), OWL.terms.inverseOf, DF.namedNode('rPred')),
      ]);
      input.request.body!.resource_relations = { rPred: [ 'name' ], '@reverse': { pred: [ 'name' ] }};
      input.request.parameters = { id: 'entry' };
      await expect(handler.handle(input)).resolves.toEqual({
        status: 200,
        body: { _id: 'entry', user_access_policy_uri: 'TODO: implement policy UI' },
      });
      expect(policies.addRule).toHaveBeenCalledTimes(1);
      const newStore = policies.addRule.mock.calls[0][0];
      expect(newStore).toBeRdfIsomorphic([
        DF.quad(DF.namedNode('entry'), ODRL.terms.partOf, DF.namedNode('collection:1')),
        DF.quad(DF.namedNode('entry'), ODRL.terms.partOf, DF.namedNode('collection:2')),
      ]);
    });
  });

  describe('with DELETE requests', (): void => {
    beforeEach(async(): Promise<void> => {
      input.request.method = 'DELETE';
      input.request.parameters = { id: 'name' };

      resourceStore.has.mockResolvedValue(true);
    });

    it('errors if no id parameter is provided.', async(): Promise<void> => {
      input.request.parameters = {};
      await expect(handler.handle(input)).rejects.toThrow('URI for DELETE operation should include an id.');
      expect(resourceStore.delete).toHaveBeenCalledTimes(0);
    });

    it('errors if the resource is not known.', async(): Promise<void> => {
      resourceStore.has.mockResolvedValueOnce(false);
      await expect(handler.handle(input)).rejects.toThrow(NotFoundHttpError);
      expect(resourceStore.delete).toHaveBeenCalledTimes(0);
    });

    it('deletes the resource.', async(): Promise<void> => {
      await expect(handler.handle(input)).resolves.toEqual({ status: 204 });
      expect(resourceStore.delete).toHaveBeenCalledTimes(1);
      expect(resourceStore.delete).toHaveBeenLastCalledWith('name');
    });
  });
});
