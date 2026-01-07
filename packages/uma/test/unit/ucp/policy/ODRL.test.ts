import { RDF, XSD } from '@solid/community-server';
import { DataFactory as DF } from 'n3';
import { basicPolicy } from '../../../../src/ucp/policy/ODRL';
import { UCPPolicy } from '../../../../src/ucp/policy/UsageControlPolicy';
import { ODRL } from '../../../../src/ucp/util/Vocabularies';

const now = new Date();
vi.useFakeTimers({ now });

describe('ODRL', (): void => {
  let policy: UCPPolicy;

  beforeEach(async(): Promise<void> => {
    policy = {
      type: 'http://www.w3.org/ns/odrl/2/Offer',
      rules: [{
        type: 'http://www.w3.org/ns/odrl/2/Prohibition',
        action: 'http://www.w3.org/ns/odrl/2/use',
        resource: 'http://example.com/foo',
        requestingParty: 'http://example.com/me',
        owner: 'http://example.com/owner',
        constraints: [{
          type: 'temporal',
          value: new Date(),
          operator: 'http://www.w3.org/ns/odrl/2/gt',
        }],
      }],
    };
  });

  describe('#basicPolicy', (): void => {
    it('creates an RDF representation of a policy.', async(): Promise<void> => {
      const iri = 'http://example.com/policy';
      const result = basicPolicy(policy, iri);
      expect(result.policyIRI).toBe(iri);
      expect(result.ruleIRIs).toHaveLength(1);

      const store = result.representation;
      const policyTerm = DF.namedNode(iri);
      const ruleTerm = result.ruleIRIs[0];
      const odrlTerm = (value: string) => DF.namedNode(ODRL.namespace + value);
      expect(store.countQuads(policyTerm, RDF.terms.type, ODRL.terms.Offer, null)).toBe(1);
      expect(store.countQuads(ruleTerm, RDF.terms.type, odrlTerm('Prohibition'), null)).toBe(1);
      expect(store.countQuads(ruleTerm, ODRL.terms.action, odrlTerm('use'), null)).toBe(1);
      expect(store.countQuads(ruleTerm, ODRL.terms.target, DF.namedNode('http://example.com/foo'), null)).toBe(1);
      expect(store.countQuads(ruleTerm, ODRL.terms.assignee, DF.namedNode('http://example.com/me'), null)).toBe(1);
      expect(store.countQuads(ruleTerm, ODRL.terms.assigner, DF.namedNode('http://example.com/owner'), null)).toBe(1);

      const constraints = result.representation.getObjects(ruleTerm, ODRL.terms.constraint, null);
      expect(constraints).toHaveLength(1);
      const constraint = constraints[0];
      expect(store.countQuads(constraint, ODRL.terms.leftOperand, ODRL.terms.dateTime, null)).toBe(1);
      expect(store.countQuads(constraint, ODRL.terms.operator, ODRL.terms.gt, null)).toBe(1);
      expect(
        store.countQuads(constraint, ODRL.terms.rightOperand, DF.literal(now.toISOString(), XSD.terms.dateTime), null),
      ).toBe(1);
    });
  });
});
