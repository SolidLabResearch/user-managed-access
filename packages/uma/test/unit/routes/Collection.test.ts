import 'jest-rdf';
import { ForbiddenHttpError, KeyValueStorage, NotFoundHttpError } from '@solid/community-server';
import { Parser, Store } from 'n3';
import { ODRL } from 'odrl-evaluator';
import { Mocked } from 'vitest';
import { WEBID } from '../../../src/credentials/Claims';
import { CredentialParser } from '../../../src/credentials/CredentialParser';
import { Verifier } from '../../../src/credentials/verify/Verifier';
import {
  AssetCollectionDescription,
  CollectionRequestHandler,
  PartyCollectionDescription
} from '../../../src/routes/Collection';
import { UCRulesStorage } from '../../../src/ucp/storage/UCRulesStorage';
import { HttpHandlerRequest } from '../../../src/util/http/models/HttpHandler';

describe('Collection', (): void => {
  const userId = 'user';
  const otherUserId = 'otherUserId';
  const ownedResource = 'http://example.com/ownedResource';
  const otherOwnedResource = 'http://example.com/otherOwnedResource';
  const unownedResource = 'http://example.com/unownedResource';
  let request: HttpHandlerRequest;
  let policyStore = new Store();

  let credentialParser: Mocked<CredentialParser>;
  let verifier: Mocked<Verifier>;
  let ownershipStore: Mocked<KeyValueStorage<string, string[]>>;
  let policies: Mocked<UCRulesStorage>;
  let handler: CollectionRequestHandler;

  beforeEach(async(): Promise<void> => {
    request = {
      url: new URL('http://example.com/collections'),
      method: 'GET',
      headers: {},
    };

    credentialParser = {
      handleSafe: vi.fn().mockResolvedValue({}),
    } satisfies Partial<CredentialParser> as any;

    verifier = {
      verify: vi.fn().mockResolvedValue({ [WEBID]: userId }),
    } satisfies Partial<Verifier> as any;

    ownershipStore = {
      get: vi.fn().mockResolvedValue([ ownedResource, otherOwnedResource ]),
    } satisfies Partial<KeyValueStorage<string, string[]>> as any;

    policyStore = new Store();
    policies = {
      getStore: vi.fn().mockResolvedValue(policyStore),
      addRule: vi.fn(async(store) => policyStore.addQuads([...store])),
      removeData: vi.fn(async(store) => policyStore.removeQuads([...store])),
    } satisfies Partial<UCRulesStorage> as any;

    handler = new CollectionRequestHandler(credentialParser, verifier, ownershipStore, policies);
  });

  describe('GET', (): void => {
    beforeEach(async(): Promise<void> => {
      request.method = 'GET';

      const collectionTurtle = `
        @prefix dc: <http://purl.org/dc/terms/>.
        @prefix odrl: <http://www.w3.org/ns/odrl/2/>.
        @prefix odrl_p: <https://w3id.org/force/odrl3proposal#>.
        @prefix owl: <http://www.w3.org/2002/07/owl#>.
        <http://example.com/assets> a odrl:AssetCollection ;
          dc:description "My assets" ;
          dc:creator <${userId}> .
        <http://example.com/foo> odrl:partOf <http://example.com/assets> .
        <http://example.com/bar> odrl:partOf <http://example.com/assets> .
        
        <http://example.com/relation> a odrl:AssetCollection ;
          odrl:source <http://example.com/container/> ;
          dc:description "My relation assets" ;
          odrl_p:relation [ owl:inverseOf <http://www.w3.org/ns/ldp#contains> ] ;
          dc:creator <${userId}> .
        <http://example.com/container/foo> odrl:partOf <http://example.com/relation> .
        <http://example.com/container/bar> odrl:partOf <http://example.com/relation> .
        
        <http://example.com/assetsOther> a odrl:AssetCollection ;
          dc:description "My assets" ;
          dc:creator <${otherUserId}> .
        <http://example.com/baz> odrl:partOf <http://example.com/assetsOther> .
        
        <http://example.com/party> a odrl:PartyCollection ;
          dc:description "My party" ;
          dc:creator <${userId}> .
        <${userId}> odrl:partOf <http://example.com/party> .
        <${otherUserId}> odrl:partOf <http://example.com/party> .
      `;

      policies.getStore.mockResolvedValue(new Store(new Parser().parse(collectionTurtle)));
    });

    it('returns all collections owned by the user.', async(): Promise<void> => {
      const response = await handler.handle({ request });
      expect(response.status).toBe(200);
      expect(response.headers?.['content-type']).toBe('text/turtle');
      expect(new Parser().parse(response.body)).toBeRdfIsomorphic(new Parser().parse(`
        @prefix dc: <http://purl.org/dc/terms/>.
        @prefix odrl: <http://www.w3.org/ns/odrl/2/>.
        @prefix odrl_p: <https://w3id.org/force/odrl3proposal#>.
        @prefix owl: <http://www.w3.org/2002/07/owl#>.
        <http://example.com/assets> a odrl:AssetCollection ;
          dc:description "My assets" ;
          dc:creator <${userId}> .
        <http://example.com/foo> odrl:partOf <http://example.com/assets> .
        <http://example.com/bar> odrl:partOf <http://example.com/assets> .
        
        <http://example.com/relation> a odrl:AssetCollection ;
          odrl:source <http://example.com/container/> ;
          dc:description "My relation assets" ;
          odrl_p:relation [ owl:inverseOf <http://www.w3.org/ns/ldp#contains> ] ;
          dc:creator <${userId}> .
        <http://example.com/container/foo> odrl:partOf <http://example.com/relation> .
        <http://example.com/container/bar> odrl:partOf <http://example.com/relation> .
        
        <http://example.com/party> a odrl:PartyCollection ;
          dc:description "My party" ;
          dc:creator <${userId}> .
        <${userId}> odrl:partOf <http://example.com/party> .
        <${otherUserId}> odrl:partOf <http://example.com/party> .
      `));
    });

    it('returns a single collection when requested.', async(): Promise<void> => {
      request.parameters = { id: 'assets' };
      request.url = new URL('http://example.com/assets');
      const response = await handler.handle({ request });
      expect(response.status).toBe(200);
      expect(response.headers?.['content-type']).toBe('text/turtle');
      expect(new Parser().parse(response.body)).toBeRdfIsomorphic(new Parser().parse(`
        @prefix dc: <http://purl.org/dc/terms/>.
        @prefix odrl: <http://www.w3.org/ns/odrl/2/>.
        <http://example.com/assets> a odrl:AssetCollection ;
          dc:description "My assets" ;
          dc:creator <${userId}> .
        <http://example.com/foo> odrl:partOf <http://example.com/assets> .
        <http://example.com/bar> odrl:partOf <http://example.com/assets> .
      `));
    });

    it('returns 404 for unknown collections.', async(): Promise<void> => {
      request.parameters = { id: 'unknown' };
      request.url = new URL('http://example.com/unknown');
      await expect(handler.handle({ request })).rejects.toThrow(NotFoundHttpError);
    });

    it('returns 403 when the user is not an owner of the collection.', async(): Promise<void> => {
      request.parameters = { id: 'assetsOther' };
      request.url = new URL('http://example.com/assetsOther');
      await expect(handler.handle({ request })).rejects.toThrow(ForbiddenHttpError);
    });
  });

  describe('POST', (): void => {
    beforeEach(async(): Promise<void> => {
      request.method = 'POST';
    });

    it('creates a new party collection.', async(): Promise<void> => {
      request.body = {
        description: "My party",
        type: "party",
        owners: [ userId ],
        parts: [ userId, otherUserId ],
      } satisfies PartyCollectionDescription;

      const response = await handler.handle({ request });
      expect(response.status).toBe(201);
      expect(response.headers?.location).toMatch(/^http:\/\/example\.com\/collections\/.+/);
      expect(policyStore).toBeRdfIsomorphic(new Parser().parse(`
        @prefix dc: <http://purl.org/dc/terms/>.
        @prefix odrl: <http://www.w3.org/ns/odrl/2/>.
        <${response.headers?.location}> a odrl:PartyCollection ;
          dc:description "My party" ;
          dc:creator <${userId}> .
        <${userId}> odrl:partOf <${response.headers?.location}> .
        <${otherUserId}> odrl:partOf <${response.headers?.location}> .
      `));
    });

    it('creates a new asset collection.', async(): Promise<void> => {
      request.body = {
        description: "My assets",
        type: "asset",
        parts: [ ownedResource ],
      } satisfies AssetCollectionDescription;

      const response = await handler.handle({ request });
      expect(response.status).toBe(201);
      expect(response.headers?.location).toMatch(/^http:\/\/example\.com\/collections\/.+/);
      expect(policyStore).toBeRdfIsomorphic(new Parser().parse(`
        @prefix dc: <http://purl.org/dc/terms/>.
        @prefix odrl: <http://www.w3.org/ns/odrl/2/>.
        <${response.headers?.location}> a odrl:AssetCollection ;
          dc:description "My assets" ;
          dc:creator <${userId}> .
        <${ownedResource}> odrl:partOf <${response.headers?.location}> .
      `));
    });

    it('requires the user to be the owner of a party collection.', async(): Promise<void> => {
      request.body = {
        description: "My party",
        type: "party",
        owners: [ otherUserId ],
        parts: [ userId, otherUserId ],
      } satisfies PartyCollectionDescription;

      await expect(handler.handle({ request })).rejects
        .toThrow('To prevent being locked out, the identity performing this request needs to be an owner');
    });

    it('requires the user to be the resource owner for party collections.', async(): Promise<void> => {
      request.body = {
        description: "My assets",
        type: "asset",
        parts: [ ownedResource, unownedResource ],
      } satisfies AssetCollectionDescription;

      await expect(handler.handle({ request })).rejects
        .toThrow(`Creating asset collection with unowned resource ${unownedResource}`);
    });
  });

  describe('PUT', (): void => {
    beforeEach(async(): Promise<void> => {
      request.method = 'PUT';

      const collectionTurtle = `
        @prefix dc: <http://purl.org/dc/terms/>.
        @prefix odrl: <http://www.w3.org/ns/odrl/2/>.
        @prefix odrl_p: <https://w3id.org/force/odrl3proposal#>.
        @prefix owl: <http://www.w3.org/2002/07/owl#>.
        <http://example.com/assets> a odrl:AssetCollection ;
          dc:description "My assets" ;
          dc:creator <${userId}> .
        <http://example.com/foo> odrl:partOf <http://example.com/assets> .
        <http://example.com/bar> odrl:partOf <http://example.com/assets> .
        
        <http://example.com/relation> a odrl:AssetCollection ;
          odrl:source <http://example.com/container/> ;
          dc:description "My relation assets" ;
          odrl_p:relation [ owl:inverseOf <http://www.w3.org/ns/ldp#contains> ] ;
          dc:creator <${userId}> .
        <http://example.com/container/foo> odrl:partOf <http://example.com/relation> .
        <http://example.com/container/bar> odrl:partOf <http://example.com/relation> .
        
        <http://example.com/assetsOther> a odrl:AssetCollection ;
          dc:description "My assets" ;
          dc:creator <${otherUserId}> .
        <http://example.com/baz> odrl:partOf <http://example.com/assetsOther> .
        
        <http://example.com/party> a odrl:PartyCollection ;
          dc:description "My party" ;
          dc:creator <${userId}> .
        <${userId}> odrl:partOf <http://example.com/party> .
        <${otherUserId}> odrl:partOf <http://example.com/party> .
      `;
      policyStore.addQuads(new Parser().parse(collectionTurtle));
    });

    it('can update an existing party collection.', async(): Promise<void> => {
      request.parameters = { id: 'party' };
      request.url = new URL('http://example.com/party');
      request.body = {
        description: "My other party",
        type: "party",
        owners: [ userId, otherUserId ],
        parts: [ userId ],
      } satisfies PartyCollectionDescription;

      const response = await handler.handle({ request });
      expect(response.status).toBe(204);
      expect(policyStore.getQuads('http://example.com/party', null, null, null)).toBeRdfIsomorphic(new Parser().parse(`
        @prefix dc: <http://purl.org/dc/terms/>.
        @prefix odrl: <http://www.w3.org/ns/odrl/2/>.
        <http://example.com/party> a odrl:PartyCollection ;
          dc:description "My other party" ;
          dc:creator <${userId}>, <${otherUserId}> .
      `));
      expect(policyStore.countQuads(userId, ODRL.terms.partOf, 'http://example.com/party', null)).toBe(1);
      expect(policyStore.countQuads(otherUserId, ODRL.terms.partOf, 'http://example.com/party', null)).toBe(0);
    });

    it('can update an existing asset collection.', async(): Promise<void> => {
      request.parameters = { id: 'assets' };
      request.url = new URL('http://example.com/assets');
      request.body = {
        description: "My other assets",
        type: "asset",
        parts: [ ownedResource, otherOwnedResource ],
      } satisfies AssetCollectionDescription;

      const response = await handler.handle({ request });
      expect(response.status).toBe(204);
      expect(policyStore.getQuads('http://example.com/assets', null, null, null)).toBeRdfIsomorphic(new Parser().parse(`
        @prefix dc: <http://purl.org/dc/terms/>.
        @prefix odrl: <http://www.w3.org/ns/odrl/2/>.
        <http://example.com/assets> a odrl:AssetCollection ;
          dc:description "My other assets" ;
          dc:creator <${userId}> .
      `));
      expect(policyStore.countQuads(ownedResource, ODRL.terms.partOf, 'http://example.com/assets', null)).toBe(1);
      expect(policyStore.countQuads(otherOwnedResource, ODRL.terms.partOf, 'http://example.com/assets', null)).toBe(1);
    });

    it('requires the user to be the owner of a party collection.', async(): Promise<void> => {
      request.parameters = { id: 'party' };
      request.url = new URL('http://example.com/party');
      request.body = {
        description: "My party",
        type: "party",
        owners: [ otherUserId ],
        parts: [ userId, otherUserId ],
      } satisfies PartyCollectionDescription;

      await expect(handler.handle({ request })).rejects
        .toThrow('To prevent being locked out, the identity performing this request needs to be an owner');
    });

    it('requires the user to be the resource owner for party collections.', async(): Promise<void> => {
      request.parameters = { id: 'assets' };
      request.url = new URL('http://example.com/assets');
      request.body = {
        description: "My assets",
        type: "asset",
        parts: [ ownedResource, unownedResource ],
      } satisfies AssetCollectionDescription;

      await expect(handler.handle({ request })).rejects
        .toThrow(`Creating asset collection with unowned resource ${unownedResource}`);
    });

    it('can not modify relation collections.', async(): Promise<void> => {
      request.parameters = { id: 'relation' };
      request.url = new URL('http://example.com/relation');
      request.body = {
        description: "My assets",
        type: "asset",
        parts: [ ownedResource ],
      } satisfies AssetCollectionDescription;

      await expect(handler.handle({ request })).rejects.toThrow(`Relation collections can not be modified`);
    });
  });

  describe('DELETE', (): void => {
    beforeEach(async(): Promise<void> => {
      request.method = 'DELETE';

      const collectionTurtle = `
        @prefix dc: <http://purl.org/dc/terms/>.
        @prefix odrl: <http://www.w3.org/ns/odrl/2/>.
        @prefix odrl_p: <https://w3id.org/force/odrl3proposal#>.
        @prefix owl: <http://www.w3.org/2002/07/owl#>.
        <http://example.com/assets> a odrl:AssetCollection ;
          dc:description "My assets" ;
          dc:creator <${userId}> .
        <http://example.com/foo> odrl:partOf <http://example.com/assets> .
        <http://example.com/bar> odrl:partOf <http://example.com/assets> .
        
        <http://example.com/relation> a odrl:AssetCollection ;
          odrl:source <http://example.com/container/> ;
          dc:description "My relation assets" ;
          odrl_p:relation [ owl:inverseOf <http://www.w3.org/ns/ldp#contains> ] ;
          dc:creator <${userId}> .
        <http://example.com/container/foo> odrl:partOf <http://example.com/relation> .
        <http://example.com/container/bar> odrl:partOf <http://example.com/relation> .
        
        <http://example.com/assetsOther> a odrl:AssetCollection ;
          dc:description "My assets" ;
          dc:creator <${otherUserId}> .
        <http://example.com/baz> odrl:partOf <http://example.com/assetsOther> .
        
        <http://example.com/party> a odrl:PartyCollection ;
          dc:description "My party" ;
          dc:creator <${userId}> .
        <${userId}> odrl:partOf <http://example.com/party> .
        <${otherUserId}> odrl:partOf <http://example.com/party> .
      `;
      policyStore.addQuads(new Parser().parse(collectionTurtle));
    });

    it('can delete collections.', async(): Promise<void> => {
      request.parameters = { id: 'party' };
      request.url = new URL('http://example.com/party');

      const response = await handler.handle({ request });
      expect(response.status).toBe(204);
      expect(policyStore.countQuads('http://example.com/party', null, null, null)).toBe(0);
      expect(policyStore.countQuads(null, null, null, 'http://example.com/party')).toBe(0);
    });

    it('returns a 404 if the collection does not exist.', async(): Promise<void> => {
      request.parameters = { id: 'unknown' };
      request.url = new URL('http://example.com/unknown');

      await expect(handler.handle({ request })).rejects.toThrow(NotFoundHttpError);
    });

    it('returns a 403 if the user is not an owner of the collection.', async(): Promise<void> => {
      request.parameters = { id: 'assetsOther' };
      request.url = new URL('http://example.com/assetsOther');

      await expect(handler.handle({ request })).rejects.toThrow(ForbiddenHttpError);
    });

    it('can not delete relation collections.', async(): Promise<void> => {
      request.parameters = { id: 'relation' };
      request.url = new URL('http://example.com/relation');

      await expect(handler.handle({ request })).rejects.toThrow(ForbiddenHttpError);
    });
  });
});
