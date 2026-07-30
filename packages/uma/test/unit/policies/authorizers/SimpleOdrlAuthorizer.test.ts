import type { NamedNode } from '@rdfjs/types';
import { DataFactory as DF, Store } from 'n3';
import { randomUUID } from 'node:crypto';
import { ODRL } from 'odrl-evaluator';
import { Mocked } from 'vitest';
import { CLIENTID, PURPOSE, VC, WEBID } from '../../../../src/credentials/Claims';
import { ClaimSet } from '../../../../src/credentials/ClaimSet';
import { Authorizer } from '../../../../src/policies/authorizers/Authorizer';
import { SimpleOdrlAuthorizer } from '../../../../src/policies/authorizers/SimpleOdrlAuthorizer';
import { UCRulesStorage } from '../../../../src/ucp/storage/UCRulesStorage';
import { OVC } from '../../../../src/ucp/util/Vocabularies';
import { Permission } from '../../../../src/views/Permission';

describe('SimpleOdrlAuthorizer', () => {
  const resource = 'res';
  const scope = 'urn:example:css:modes:read';
  const odrlScope = 'http://www.w3.org/ns/odrl/2/read';
  const query: Permission[] = [{ resource_id: resource, resource_scopes: [scope] }];
  const fallbackPermissions: Permission[] = [{ resource_id: 'fallback', resource_scopes: ['scope'] }];

  let policies: Mocked<UCRulesStorage>;
  let fallback: Mocked<Authorizer>;
  let store: Store;
  let authorizer: SimpleOdrlAuthorizer;

  const addRule = ({
    assignee,
    linkPredicate = ODRL.terms.permission,
    target = resource,
    action = odrlScope,
  }: {
    assignee?: string;
    linkPredicate?: NamedNode;
    target?: string;
    action?: string;
  }): NamedNode => {
    const rule = `rule-${randomUUID()}`;
    const ruleNode = DF.namedNode(rule);
    store.addQuad(ruleNode, ODRL.terms.target, DF.namedNode(target));
    store.addQuad(ruleNode, ODRL.terms.action, DF.namedNode(action));
    if (assignee) {
      store.addQuad(ruleNode, ODRL.terms.assignee, DF.namedNode(assignee));
    }
    store.addQuad(DF.namedNode(`${rule}:policy`), linkPredicate, ruleNode);
    return ruleNode;
  };

  const addConstraint = ({
    rule,
    leftOperand,
    operator,
    rightOperand,
  }: {
    rule: NamedNode;
    leftOperand: NamedNode;
    operator: NamedNode;
    rightOperand: string;
  }): void => {
    const constraint = DF.namedNode(`constraint-${randomUUID()}`);
    store.addQuad(rule, ODRL.terms.constraint, constraint);
    store.addQuad(constraint, ODRL.terms.leftOperand, leftOperand);
    store.addQuad(constraint, ODRL.terms.operator, operator);
    store.addQuad(constraint, ODRL.terms.rightOperand, DF.literal(rightOperand));
  };

  beforeEach(() => {
    store = new Store();

    fallback = {
      permissions: vi.fn().mockResolvedValue(fallbackPermissions),
    } satisfies Partial<Authorizer> as unknown as Mocked<Authorizer>;

    policies = {
      getStore: vi.fn().mockResolvedValue(store),
    } satisfies Partial<UCRulesStorage> as unknown as Mocked<UCRulesStorage>;

    authorizer = new SimpleOdrlAuthorizer(policies, fallback);
  });

  it('delegates to fallback if no query is provided', async () => {
    await expect(authorizer.permissions({})).resolves.toEqual(fallbackPermissions);
    expect(fallback.permissions).toHaveBeenCalledWith({}, undefined);
  });

  it('returns empty if no rules match the resource', async () => {
    await expect(authorizer.permissions({}, query)).resolves.toEqual([]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns permission if rule matches resource, action, and assignee', async () => {
    addRule({ assignee: 'user' });
    const claims = { [WEBID]: 'user' };

    await expect(authorizer.permissions(claims, query))
      .resolves.toEqual([{ resource_id: resource, resource_scopes: [scope] }]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns permission for public access (no assignee)', async () => {
    addRule({});

    await expect(authorizer.permissions({}, query))
      .resolves.toEqual([{ resource_id: resource, resource_scopes: [scope] }]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns empty if assignee does not match', async () => {
    addRule({ assignee: 'other' });
    const claims = { [WEBID]: 'user' };

    await expect(authorizer.permissions(claims, query)).resolves.toEqual([]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns empty if rule is a prohibition', async () => {
    addRule({ linkPredicate: ODRL.terms.prohibition });

    await expect(authorizer.permissions({}, query)).resolves.toEqual([]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('delegates to fallback if rule has unsupported type', async () => {
    addRule({ linkPredicate: DF.namedNode('unsupported') });

    await expect(authorizer.permissions({}, query)).resolves.toEqual(fallbackPermissions);
    expect(fallback.permissions).toHaveBeenCalledWith({}, query);
  });

  it('returns empty if constraint is not satisfied (deliveryChannel)', async () => {
    const rule = addRule({});
    addConstraint({
      rule,
      leftOperand: ODRL.terms.deliveryChannel,
      operator: ODRL.terms.eq,
      rightOperand: 'clientA',
    });
    const claims = { [CLIENTID]: 'clientB' };

    await expect(authorizer.permissions(claims, query)).resolves.toEqual([]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns permission if constraint is satisfied (deliveryChannel)', async () => {
    const rule = addRule({});
    addConstraint({
      rule,
      leftOperand: ODRL.terms.deliveryChannel,
      operator: ODRL.terms.eq,
      rightOperand: 'clientA',
    });
    const claims = { [CLIENTID]: 'clientA' };

    await expect(authorizer.permissions(claims, query))
      .resolves.toEqual([{ resource_id: resource, resource_scopes: [scope] }]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns permission if other constraints are satisfied', async () => {
    const rule = addRule({});
    addConstraint({
      rule,
      leftOperand: ODRL.terms.purpose,
      operator: ODRL.terms.eq,
      rightOperand: 'https://w3id.org/dpv#ScientificResearch',
    });
    const claims = { [PURPOSE]: 'https://w3id.org/dpv#ScientificResearch' };

    await expect(authorizer.permissions(claims, query))
      .resolves.toEqual([{ resource_id: resource, resource_scopes: [scope] }]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns empty if other constraints are not satisfied', async () => {
    const rule = addRule({});
    addConstraint({
      rule,
      leftOperand: ODRL.terms.purpose,
      operator: ODRL.terms.eq,
      rightOperand: 'http://example.com/purpose-a',
    });
    const claims = { [PURPOSE]: 'http://example.com/purpose-b' };

    await expect(authorizer.permissions(claims, query)).resolves.toEqual([]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('delegates to fallback if constraint is too complex', async () => {
    const rule = addRule({});
    store.addQuad(rule, ODRL.terms.constraint, DF.namedNode('constraint3'));

    await expect(authorizer.permissions({}, query)).resolves.toEqual(fallbackPermissions);
    expect(fallback.permissions).toHaveBeenCalledWith({}, query);
  });

  it('returns empty if dateTime constraint is not satisfied', async () => {
    const rule = addRule({});
    addConstraint({
      rule,
      leftOperand: ODRL.terms.dateTime,
      operator: ODRL.terms.gt,
      rightOperand: new Date(Date.now() + 1000000).toISOString(),
    });

    await expect(authorizer.permissions({}, query)).resolves.toEqual([]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns permission if dateTime constraint is satisfied', async () => {
    const rule = addRule({});
    addConstraint({
      rule,
      leftOperand: ODRL.terms.dateTime,
      operator: ODRL.terms.lt,
      rightOperand: new Date(Date.now() + 1000000).toISOString(),
    });

    await expect(authorizer.permissions({}, query))
      .resolves.toEqual([{ resource_id: resource, resource_scopes: [scope] }]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('delegates to fallback if OVC constraint is too complex', async () => {
    const rule = addRule({});
    store.addQuad(rule, OVC.terms.constraint, DF.namedNode('constraint3'));

    await expect(authorizer.permissions({}, query)).resolves.toEqual(fallbackPermissions);
    expect(fallback.permissions).toHaveBeenCalledWith({}, query);
  });

  it('returns empty if there is an OVC constraint but no VC claim.', async(): Promise<void> => {
    const rule = addRule({});

    const jsonPath = '$.credentialSubject.garden.fruit';
    const constraint = DF.namedNode(`ovc-constraint-${randomUUID()}`);
    store.addQuad(rule, OVC.terms.constraint, constraint);
    store.addQuad(constraint, OVC.terms.leftOperand, DF.namedNode(jsonPath));
    store.addQuad(constraint, ODRL.terms.operator, ODRL.terms.eq);
    store.addQuad(constraint, ODRL.terms.rightOperand, DF.literal('apple'));

    await expect(authorizer.permissions({}, query)).resolves.toEqual([]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns permissions if the OVC constraint is satisfied.', async(): Promise<void> => {
    const rule = addRule({});

    const jsonPath = '$.credentialSubject.garden.fruit';
    const constraint = DF.namedNode(`ovc-constraint-${randomUUID()}`);
    store.addQuad(rule, OVC.terms.constraint, constraint);
    store.addQuad(constraint, OVC.terms.leftOperand, DF.namedNode(jsonPath));
    store.addQuad(constraint, ODRL.terms.operator, ODRL.terms.eq);
    store.addQuad(constraint, ODRL.terms.rightOperand, DF.literal('apple'));
    store.addQuad(constraint, OVC.terms.credentialSubjectType, DF.namedNode('http://example.com/type'));

    const claims = { [VC]: {
        type: [ 'http://example.com/type' ],
        credentialSubject: { garden: { fruit: 'apple' }}
      }};
    await expect(authorizer.permissions(claims, query))
      .resolves.toEqual([{ resource_id: resource, resource_scopes: [scope] }]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns empty if the OVC constraint is not satisfied.', async(): Promise<void> => {
    const rule = addRule({});

    const jsonPath = '$.credentialSubject.garden.fruit';
    const constraint = DF.namedNode(`ovc-constraint-${randomUUID()}`);
    store.addQuad(rule, OVC.terms.constraint, constraint);
    store.addQuad(constraint, OVC.terms.leftOperand, DF.namedNode(jsonPath));
    store.addQuad(constraint, ODRL.terms.operator, ODRL.terms.eq);
    store.addQuad(constraint, ODRL.terms.rightOperand, DF.literal('apple'));
    store.addQuad(constraint, OVC.terms.credentialSubjectType, DF.namedNode('http://example.com/type'));

    let claims: ClaimSet = { [VC]: {
        credentialSubject: { garden: { fruit: 'apple' }}
      }};
    await expect(authorizer.permissions(claims, query)).resolves.toEqual([]);
    claims = { [VC]: {
        type: [ 'http://example.com/type' ],
        credentialSubject: { garden: { fruit: 'pear' }}
      }};
    await expect(authorizer.permissions(claims, query)).resolves.toEqual([]);

    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns all permissions when multiple query entries are all granted', async () => {
    const resource2 = 'res2';
    const scope2 = 'urn:example:css:modes:write';
    const odrlScope2 = 'http://www.w3.org/ns/odrl/2/modify';
    const multiQuery: Permission[] = [
      { resource_id: resource, resource_scopes: [scope] },
      { resource_id: resource2, resource_scopes: [scope2] },
    ];
    addRule({});
    addRule({ target: resource2, action: odrlScope2 });

    await expect(authorizer.permissions({}, multiQuery)).resolves.toEqual([
      { resource_id: resource, resource_scopes: [scope] },
      { resource_id: resource2, resource_scopes: [scope2] },
    ]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('delegates entire result to fallback if any query entry cannot be handled', async () => {
    const resource2 = 'res2';
    const multiQuery: Permission[] = [
      { resource_id: resource, resource_scopes: [scope] },
      { resource_id: resource2, resource_scopes: [scope] },
    ];
    addRule({});
    // rule for resource2 has an unsupported link predicate, triggering fallback
    addRule({ target: resource2, linkPredicate: DF.namedNode('unsupported') });

    await expect(authorizer.permissions({}, multiQuery)).resolves.toEqual(fallbackPermissions);
    expect(fallback.permissions).toHaveBeenCalledWith({}, multiQuery);
  });

  it('returns permission if rule has odrl:modify action and scope is css:write', async () => {
    const writeScope = 'urn:example:css:modes:write';
    const writeQuery: Permission[] = [{ resource_id: resource, resource_scopes: [writeScope] }];
    addRule({ action: 'http://www.w3.org/ns/odrl/2/modify' });

    await expect(authorizer.permissions({}, writeQuery))
      .resolves.toEqual([{ resource_id: resource, resource_scopes: [writeScope] }]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns permission if rule has odrl:modify action and scope is css:append', async () => {
    const appendScope = 'urn:example:css:modes:append';
    const appendQuery: Permission[] = [{ resource_id: resource, resource_scopes: [appendScope] }];
    addRule({ action: 'http://www.w3.org/ns/odrl/2/modify' });

    await expect(authorizer.permissions({}, appendQuery))
      .resolves.toEqual([{ resource_id: resource, resource_scopes: [appendScope] }]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('does not grant odrl:write scope when rule only has odrl:append action', async () => {
    const writeScope = 'urn:example:css:modes:write';
    const writeQuery: Permission[] = [{ resource_id: resource, resource_scopes: [writeScope] }];
    addRule({ action: 'http://www.w3.org/ns/odrl/2/append' });

    await expect(authorizer.permissions({}, writeQuery)).resolves.toEqual([]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('does not grant odrl:modify scope when rule only has odrl:write action', async () => {
    const rawModifyQuery: Permission[] = [{ resource_id: resource, resource_scopes: ['http://www.w3.org/ns/odrl/2/modify'] }];
    addRule({ action: 'http://www.w3.org/ns/odrl/2/write' });

    await expect(authorizer.permissions({}, rawModifyQuery)).resolves.toEqual([]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });
});
