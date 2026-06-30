import { DataFactory, Parser, Store } from 'n3';
import { patchAccessRequest } from '../../../../src/util/routeSpecific/patch';

const { namedNode } = DataFactory;

describe('routeSpecific/patch', (): void => {
  const owner = 'http://rs.local:3000/alice/profile/card#me';
  const requester = 'http://rs.local:3000/bob/profile/card#me';
  const target = 'http://rs.local:3000/alice/resource.txt';
  const request = 'https://solid4media.ilabt.imec.be/uma/access-requests/34f152162e6e5e3c';

  it('can accept an access request by compact id.', async(): Promise<void> => {
    const store = new Store(new Parser().parse(`
      @prefix ex: <http://example.org/> .
      @prefix sotw: <https://w3id.org/force/sotw#> .
      @prefix dcterms: <http://purl.org/dc/terms/> .
      @prefix odrl: <http://www.w3.org/ns/odrl/2/> .

      <${request}> a sotw:EvaluationRequest ;
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

    await patchAccessRequest(store, '2F34f152162e6e5e3c', owner, 'accepted');

    expect(store.countQuads(namedNode(request), namedNode('http://example.org/requestStatus'), namedNode('http://example.org/accepted'), null)).toBe(1);
    expect(store.countQuads(null, namedNode('http://www.w3.org/ns/odrl/2/assignee'), namedNode(requester), null)).toBe(1);
  });
});
