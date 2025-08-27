import { NotImplementedHttpError, RDF, XSD } from '@solid/community-server';
import { basicPolicy, ODRL, UCRulesStorage } from '@solidlab/ucp';
import { DataFactory as DF, Parser, Store } from 'n3';
import { ODRLEvaluator } from 'odrl-evaluator';
import { Mocked } from 'vitest';
import { OdrlAuthorizer } from '../../../../src/policies/authorizers/OdrlAuthorizer';
import { Permission } from '../../../../src/views/Permission';

const now = new Date();
vi.useFakeTimers({ now });

vi.mock('@solidlab/ucp', async(importOriginal) => ({
    ...await importOriginal(),
    basicPolicy: vi.fn(),
}));

describe('OdrlAuthorizer', (): void => {
  const sotw = [ DF.quad(
    DF.namedNode('http://example.com/request/currentTime'),
    DF.namedNode('http://purl.org/dc/terms/issued'),
    DF.literal(now.toISOString(), XSD.terms.dateTime),
  )];

  const evaluate = vi.spyOn(ODRLEvaluator.prototype, 'evaluate');

  const requestQuads = [ DF.quad(DF.namedNode('req'), RDF.terms.type, DF.namedNode('Request')) ];
  let policyStore = new Store([ DF.quad(DF.namedNode('policy'), RDF.terms.type, DF.namedNode('Policy')) ]);
  let policies: Mocked<UCRulesStorage>;
  let authorizer: OdrlAuthorizer;

  beforeEach(async(): Promise<void> => {
    vi.clearAllMocks();
    evaluate.mockResolvedValue([]);

    vi.mocked(basicPolicy).mockReturnValueOnce({
      ruleIRIs:[],
      policyIRI: '',
      representation: new Store(requestQuads),
    });

    policyStore = new Store();
    policies = {
      getStore: vi.fn().mockResolvedValue(policyStore),
    } satisfies Partial<UCRulesStorage> as any;

    authorizer = new OdrlAuthorizer(policies);
  });

  it('does not support credentials requests.', async(): Promise<void> => {
    await expect(authorizer.credentials([])).rejects.toThrow(NotImplementedHttpError);
  });

  it('returns an empty result if there is no query.', async(): Promise<void> => {
    await expect(authorizer.permissions({})).resolves.toEqual([]);
    expect(evaluate).toHaveBeenCalledTimes(0);
  });

  it('calls the evaluator with the generated policy request.', async(): Promise<void> => {
    const query: Permission[] = [{ resource_id: 'rid', resource_scopes: [ 'urn:example:css:modes:read' ] }];

    // No result as the current evaluate mock returns an empty list
    await expect(authorizer.permissions({}, query)).resolves.toEqual([{ resource_id: 'rid', resource_scopes: [] }]);
    expect(basicPolicy).toHaveBeenCalledTimes(1);
    expect(basicPolicy).toHaveBeenLastCalledWith({
      type: 'http://www.w3.org/ns/odrl/2/Request',
      rules: [{
        action: 'http://www.w3.org/ns/odrl/2/read',
        resource: 'rid',
        requestingParty: 'urn:solidlab:uma:id:anonymous'
      }],
    });
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenLastCalledWith(
      policyStore.getQuads(null, null, null, null),
      requestQuads,
      sotw,
    );
  });

  it('calls the evaluator with the WebID claim if there is one.', async(): Promise<void> => {
    const claims = { 'urn:solidlab:uma:claims:types:webid': 'http://example.com/#me' };
    const query: Permission[] = [{ resource_id: 'rid', resource_scopes: [ 'urn:example:css:modes:read' ] }];

    // No result as the current evaluate mock returns an empty list
    await expect(authorizer.permissions(claims, query)).resolves.toEqual([{ resource_id: 'rid', resource_scopes: [] }]);
    expect(basicPolicy).toHaveBeenCalledTimes(1);
    expect(basicPolicy).toHaveBeenLastCalledWith({
      type: 'http://www.w3.org/ns/odrl/2/Request',
      rules: [{
        action: 'http://www.w3.org/ns/odrl/2/read',
        resource: 'rid',
        requestingParty: 'http://example.com/#me'
      }],
    });
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenLastCalledWith(
      policyStore.getQuads(null, null, null, null),
      requestQuads,
      sotw,
    );
  });

  it('extracts the allowed scopes from the resulting report.', async(): Promise<void> => {
    const query: Permission[] = [{ resource_id: 'rid', resource_scopes: [ 'urn:example:css:modes:read' ] }];

    const report = `
      @prefix cr: <https://w3id.org/force/compliance-report#> .
      @prefix dc: <http://purl.org/dc/terms/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      <urn:policyReport> a cr:PolicyReport ;
        cr:ruleReport <urn:ruleReport> .
      <urn:ruleReport> a cr:PermissionReport ;
        cr:activationState cr:Active ;
        cr:premiseReport <urn:premiseReport> .
      <urn:premiseReport> a cr:Target-Report ;
        cr:satisfactionState cr:Satisfied .
    `;
    evaluate.mockResolvedValueOnce(new Parser().parse(report));

    await expect(authorizer.permissions({}, query)).resolves
      .toEqual([{ resource_id: 'rid', resource_scopes: [ 'urn:example:css:modes:read' ] }]);
    expect(basicPolicy).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('does not grant scopes if the report is inactive.', async(): Promise<void> => {
    const query: Permission[] = [{ resource_id: 'rid', resource_scopes: [ 'urn:example:css:modes:read' ] }];

    const report = `
      @prefix cr: <https://w3id.org/force/compliance-report#> .
      @prefix dc: <http://purl.org/dc/terms/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      <urn:policyReport> a cr:PolicyReport ;
        cr:ruleReport <urn:ruleReport> .
      <urn:ruleReport> a cr:PermissionReport ;
        cr:activationState cr:Inactive ;
        cr:premiseReport <urn:premiseReport> .
      <urn:premiseReport> a cr:Target-Report ;
        cr:satisfactionState cr:Satisfied .
    `;
    evaluate.mockResolvedValueOnce(new Parser().parse(report));

    await expect(authorizer.permissions({}, query)).resolves
      .toEqual([{ resource_id: 'rid', resource_scopes: [] }]);
    expect(basicPolicy).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('does not grant scopes if the report is a prohibition.', async(): Promise<void> => {
    const query: Permission[] = [{ resource_id: 'rid', resource_scopes: [ 'urn:example:css:modes:read' ] }];

    const report = `
      @prefix cr: <https://w3id.org/force/compliance-report#> .
      @prefix dc: <http://purl.org/dc/terms/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      <urn:policyReport> a cr:PolicyReport ;
        cr:ruleReport <urn:ruleReport> .
      <urn:ruleReport> a cr:ProhibitionReport ;
        cr:activationState cr:Active ;
        cr:premiseReport <urn:premiseReport> .
      <urn:premiseReport> a cr:Target-Report ;
        cr:satisfactionState cr:Satisfied .
    `;
    evaluate.mockResolvedValueOnce(new Parser().parse(report));

    await expect(authorizer.permissions({}, query)).resolves
      .toEqual([{ resource_id: 'rid', resource_scopes: [] }]);
    expect(basicPolicy).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('performs a query for every resource and scope.', async(): Promise<void> => {
    const query: Permission[] = [
      { resource_id: 'rid1', resource_scopes: [ 'urn:example:css:modes:read' ] },
      { resource_id: 'rid2', resource_scopes: [ 'urn:example:css:modes:write', 'urn:example:css:modes:create' ] },
    ];

    const permissionReport = `
      @prefix cr: <https://w3id.org/force/compliance-report#> .
      @prefix dc: <http://purl.org/dc/terms/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      <urn:policyReport> a cr:PolicyReport ;
        cr:ruleReport <urn:ruleReport> .
      <urn:ruleReport> a cr:PermissionReport ;
        cr:activationState cr:Active ;
        cr:premiseReport <urn:premiseReport> .
      <urn:premiseReport> a cr:Target-Report ;
        cr:satisfactionState cr:Satisfied .
    `;
    const prohibitionReport = `
      @prefix cr: <https://w3id.org/force/compliance-report#> .
      @prefix dc: <http://purl.org/dc/terms/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      <urn:policyReport> a cr:PolicyReport ;
        cr:ruleReport <urn:ruleReport> .
      <urn:ruleReport> a cr:ProhibitionReport ;
        cr:activationState cr:Active ;
        cr:premiseReport <urn:premiseReport> .
      <urn:premiseReport> a cr:Target-Report ;
        cr:satisfactionState cr:Satisfied .
    `;
    evaluate.mockResolvedValueOnce(new Parser().parse(permissionReport));
    evaluate.mockResolvedValueOnce(new Parser().parse(prohibitionReport));
    evaluate.mockResolvedValueOnce(new Parser().parse(permissionReport));

    await expect(authorizer.permissions({}, query)).resolves
      .toEqual([
        { resource_id: 'rid1', resource_scopes: [ 'urn:example:css:modes:read' ] },
        { resource_id: 'rid2', resource_scopes: [ 'urn:example:css:modes:create' ]
      }]);
    expect(basicPolicy).toHaveBeenCalledTimes(3);
    expect(evaluate).toHaveBeenCalledTimes(3);
  });
});
