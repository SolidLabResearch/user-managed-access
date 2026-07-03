import { DataFactory, Parser, Store } from 'n3';
import { patchAccessRequest, patchPolicy } from '../../../../src/util/routeSpecific/patch';

const { namedNode } = DataFactory;

describe('routeSpecific/patch', (): void => {
  const owner = 'http://rs.local:3000/alice/profile/card#me';
  const requester = 'http://rs.local:3000/bob/profile/card#me';
  const target = 'http://rs.local:3000/alice/resource.txt';
  const request = 'https://solid4media.ilabt.imec.be/uma/access-requests/34f152162e6e5e3c';
  const urnRequest = 'urn:uuid:fb26b948-9f9e-4c74-8192-36e7a560ba79';

  it('can patch in-scope policies without a policy id.', async(): Promise<void> => {
    const store = createPolicyStore();

    await patchPolicy(store, undefined, owner, `
      PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

      DELETE {
        <http://example.org/owner-rule> odrl:action odrl:read .
      } INSERT {
        <http://example.org/owner-rule> odrl:action odrl:write .
      } WHERE {
        <http://example.org/owner-rule> odrl:action odrl:read .
      }
    `);

    expect(store.countQuads(namedNode('http://example.org/owner-rule'), namedNode('http://www.w3.org/ns/odrl/2/action'), namedNode('http://www.w3.org/ns/odrl/2/read'), null)).toBe(0);
    expect(store.countQuads(namedNode('http://example.org/owner-rule'), namedNode('http://www.w3.org/ns/odrl/2/action'), namedNode('http://www.w3.org/ns/odrl/2/write'), null)).toBe(1);
  });

  it('rejects id-less policy patches outside the owner scope without mutating the store.', async(): Promise<void> => {
    const store = createPolicyStore();

    await expect(patchPolicy(store, undefined, owner, `
      PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

      DELETE {
        <http://example.org/requester-rule> odrl:action odrl:read .
      } INSERT {
        <http://example.org/requester-rule> odrl:action odrl:write .
      } WHERE {
        <http://example.org/requester-rule> odrl:action odrl:read .
      }
    `)).rejects.toMatchObject({ status: 403 });

    expect(store.countQuads(namedNode('http://example.org/requester-rule'), namedNode('http://www.w3.org/ns/odrl/2/action'), namedNode('http://www.w3.org/ns/odrl/2/read'), null)).toBe(1);
    expect(store.countQuads(namedNode('http://example.org/requester-rule'), namedNode('http://www.w3.org/ns/odrl/2/action'), namedNode('http://www.w3.org/ns/odrl/2/write'), null)).toBe(0);
  });

  it('can accept an access request by compact id.', async(): Promise<void> => {
    const store = createStore(request);

    await patchAccessRequest(store, '2F34f152162e6e5e3c', owner, 'accepted');

    expect(store.countQuads(namedNode(request), namedNode('http://example.org/requestStatus'), namedNode('http://example.org/accepted'), null)).toBe(1);
    expect(store.countQuads(null, namedNode('http://www.w3.org/ns/odrl/2/assignee'), namedNode(requester), null)).toBe(1);
  });

  it('can accept an access request by encoded URN id.', async(): Promise<void> => {
    const store = createStore(urnRequest);

    await patchAccessRequest(store, 'urn%3Auuid%3Afb26b948-9f9e-4c74-8192-36e7a560ba79', owner, 'accepted');

    expect(store.countQuads(namedNode(urnRequest), namedNode('http://example.org/requestStatus'), namedNode('http://example.org/accepted'), null)).toBe(1);
    expect(store.countQuads(null, namedNode('http://www.w3.org/ns/odrl/2/assignee'), namedNode(requester), null)).toBe(1);
  });

  it('rejects access request acceptance by a non-owner.', async(): Promise<void> => {
    const store = createStore(urnRequest);

    await expect(patchAccessRequest(store, 'urn%3Auuid%3Afb26b948-9f9e-4c74-8192-36e7a560ba79', requester, 'accepted'))
      .rejects.toMatchObject({ status: 403 });

    expect(store.countQuads(namedNode(urnRequest), namedNode('http://example.org/requestStatus'), namedNode('http://example.org/accepted'), null)).toBe(0);
    expect(store.countQuads(null, namedNode('http://www.w3.org/ns/odrl/2/assignee'), namedNode(requester), null)).toBe(0);
  });

  function createStore(requestId: string): Store {
    return new Store(new Parser().parse(`
      @prefix ex: <http://example.org/> .
      @prefix sotw: <https://w3id.org/force/sotw#> .
      @prefix dcterms: <http://purl.org/dc/terms/> .
      @prefix odrl: <http://www.w3.org/ns/odrl/2/> .

      <${requestId}> a sotw:EvaluationRequest ;
        dcterms:issued "2026-06-30T00:00:00.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> ;
        sotw:requestedTarget <${target}> ;
        sotw:requestedAction odrl:read ;
        sotw:requestingParty <${requester}> ;
        ex:requestStatus ex:requested .

      <http://example.org/owner-policy> a odrl:Agreement ;
        odrl:permission <http://example.org/owner-permission> .

      <http://example.org/owner-permission> a odrl:Permission ;
        odrl:target <${target}> ;
        odrl:assigner <${owner}> .
    `));
  }

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

      <http://example.org/requester-policy> a odrl:Agreement ;
        odrl:uid <http://example.org/requester-policy> ;
        odrl:permission <http://example.org/requester-rule> .

      <http://example.org/requester-rule> a odrl:Permission ;
        odrl:action odrl:read ;
        odrl:target <${target}> ;
        odrl:assignee <${owner}> ;
        odrl:assigner <${requester}> .
    `));
  }
});
