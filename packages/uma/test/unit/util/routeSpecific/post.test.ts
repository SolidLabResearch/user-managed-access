import { RDF } from '@solid/community-server';
import { DataFactory, Parser, Store } from 'n3';
import { createAccessRequestsFromTicket, postPolicy } from '../../../../src/util/routeSpecific/post';
import { ODRL } from '../../../../src/ucp/util/Vocabularies';

const { namedNode } = DataFactory;

describe('routeSpecific/post', (): void => {
  const owner = 'http://rs.local:3000/alice/profile/card#me';
  const target = 'http://localhost:4050/aggregators/02dca48c3ff92d72b5edbbb2/services/fit-gpx-to-rdf/output';

  it('normalizes Agreement policies without assignee to Set policies for public access.', async(): Promise<void> => {
    const store = parsePolicy(`
      @prefix odrl: <http://www.w3.org/ns/odrl/2/> .

      <http://example.org/policy> a odrl:Agreement ;
        odrl:uid <http://example.org/policy> ;
        odrl:permission <http://example.org/rule> .

      <http://example.org/rule> a odrl:Permission ;
        odrl:action odrl:read ;
        odrl:target <${target}> ;
        odrl:assigner <${owner}> .
    `);

    const result = await postPolicy(store, owner);

    expect(result.countQuads(null, RDF.terms.type, ODRL.terms.Agreement, null)).toBe(0);
    expect(result.countQuads(null, RDF.terms.type, ODRL.terms.Set, null)).toBe(1);
  });

  it('accepts Set policies without assignee for public access.', async(): Promise<void> => {
    const store = parsePolicy(`
      @prefix odrl: <http://www.w3.org/ns/odrl/2/> .

      <http://example.org/policy> a odrl:Set ;
        odrl:uid <http://example.org/policy> ;
        odrl:permission <http://example.org/rule> .

      <http://example.org/rule> a odrl:Permission ;
        odrl:action odrl:read ;
        odrl:target <${target}> ;
        odrl:assigner <${owner}> .
    `);

    const result = await postPolicy(store, owner);

    expect(result.size).toBe(store.size);
  });

  it('creates access requests from ticket permissions with repeated requested actions.', (): void => {
    const result = createAccessRequestsFromTicket({
      permissions: [{
        resource_id: target,
        resource_scopes: [
          'urn:example:css:modes:read',
          'urn:example:css:modes:write',
        ],
      }],
      required: [],
      provided: {},
    }, owner);

    const request = result.getSubjects(RDF.terms.type, namedNode('https://w3id.org/force/sotw#EvaluationRequest'), null)[0];

    expect(request).toBeDefined();
    expect(result.countQuads(request, namedNode('https://w3id.org/force/sotw#requestedTarget'), namedNode(target), null)).toBe(1);
    expect(result.countQuads(request, namedNode('https://w3id.org/force/sotw#requestingParty'), namedNode(owner), null)).toBe(1);
    expect(result.countQuads(request, namedNode('https://w3id.org/force/sotw#requestedAction'), ODRL.terms.read, null)).toBe(1);
    expect(result.countQuads(request, namedNode('https://w3id.org/force/sotw#requestedAction'), ODRL.terms.write, null)).toBe(1);
  });

  function parsePolicy(policy: string): Store {
    return new Store(new Parser().parse(policy));
  }
});
