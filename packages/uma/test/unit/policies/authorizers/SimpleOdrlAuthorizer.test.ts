import type { NamedNode } from '@rdfjs/types';
import { DataFactory as DF, Store } from 'n3';
import { randomUUID } from 'node:crypto';
import { ODRL } from 'odrl-evaluator';
import { Mocked } from 'vitest';
import { Authorizer } from '../../../../src/policies/authorizers/Authorizer';
import { SimpleOdrlAuthorizer } from '../../../../src/policies/authorizers/SimpleOdrlAuthorizer';
import { UCRulesStorage } from '../../../../src/ucp/storage/UCRulesStorage';
import { Permission } from '../../../../src/views/Permission';
import { WEBID, CLIENTID } from '../../../../src/credentials/Claims';

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
    const result = await authorizer.permissions({});
    expect(result).toEqual(fallbackPermissions);
    expect(fallback.permissions).toHaveBeenCalledWith({}, undefined);
  });

  it('returns empty if no rules match the resource', async () => {
    const result = await authorizer.permissions({}, query);
    expect(result).toEqual([]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns permission if rule matches resource, action, and assignee', async () => {
    addRule({ assignee: 'user' });
    const claims = { [WEBID]: 'user' };

    const result = await authorizer.permissions(claims, query);

    expect(result).toEqual([{ resource_id: resource, resource_scopes: [scope] }]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns permission for public access (no assignee)', async () => {
    addRule({});

    const result = await authorizer.permissions({}, query);

    expect(result).toEqual([{ resource_id: resource, resource_scopes: [scope] }]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns empty if assignee does not match', async () => {
    addRule({ assignee: 'other' });
    const claims = { [WEBID]: 'user' };

    const result = await authorizer.permissions(claims, query);

    expect(result).toEqual([]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns empty if rule is a prohibition', async () => {
    addRule({ linkPredicate: ODRL.terms.prohibition });

    const result = await authorizer.permissions({}, query);

    expect(result).toEqual([]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('delegates to fallback if rule has unsupported type', async () => {
    addRule({ linkPredicate: DF.namedNode('unsupported') });

    const result = await authorizer.permissions({}, query);

    expect(result).toEqual(fallbackPermissions);
    expect(fallback.permissions).toHaveBeenCalledWith({}, query);
  });

  it('returns empty if constraint is not satisfied (purpose)', async () => {
    const rule = addRule({});
    addConstraint({
      rule,
      leftOperand: ODRL.terms.purpose,
      operator: ODRL.terms.eq,
      rightOperand: 'clientA',
    });
    const claims = { [CLIENTID]: 'clientB' };

    const result = await authorizer.permissions(claims, query);

    expect(result).toEqual([]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns permission if constraint is satisfied (purpose)', async () => {
    const rule = addRule({});
    addConstraint({
      rule,
      leftOperand: ODRL.terms.purpose,
      operator: ODRL.terms.eq,
      rightOperand: 'clientA',
    });
    const claims = { [CLIENTID]: 'clientA' };

    const result = await authorizer.permissions(claims, query);

    expect(result).toEqual([{ resource_id: resource, resource_scopes: [scope] }]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('delegates to fallback if constraint is too complex', async () => {
    const rule = addRule({});
    store.addQuad(rule, ODRL.terms.constraint, DF.namedNode('constraint3'));

    const result = await authorizer.permissions({}, query);

    expect(result).toEqual(fallbackPermissions);
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

    const result = await authorizer.permissions({}, query);

    expect(result).toEqual([]);
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

    const result = await authorizer.permissions({}, query);

    expect(result).toEqual([{ resource_id: resource, resource_scopes: [scope] }]);
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

    const result = await authorizer.permissions({}, multiQuery);

    expect(result).toEqual([
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

    const result = await authorizer.permissions({}, multiQuery);

    expect(result).toEqual(fallbackPermissions);
    expect(fallback.permissions).toHaveBeenCalledWith({}, multiQuery);
  });

  it('returns permission if rule has odrl:modify action and scope is css:write', async () => {
    const writeScope = 'urn:example:css:modes:write';
    const writeQuery: Permission[] = [{ resource_id: resource, resource_scopes: [writeScope] }];
    addRule({ action: 'http://www.w3.org/ns/odrl/2/modify' });

    const result = await authorizer.permissions({}, writeQuery);

    expect(result).toEqual([{ resource_id: resource, resource_scopes: [writeScope] }]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('returns permission if rule has odrl:modify action and scope is css:append', async () => {
    const appendScope = 'urn:example:css:modes:append';
    const appendQuery: Permission[] = [{ resource_id: resource, resource_scopes: [appendScope] }];
    addRule({ action: 'http://www.w3.org/ns/odrl/2/modify' });

    const result = await authorizer.permissions({}, appendQuery);

    expect(result).toEqual([{ resource_id: resource, resource_scopes: [appendScope] }]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('does not grant odrl:write scope when rule only has odrl:append action', async () => {
    const writeScope = 'urn:example:css:modes:write';
    const writeQuery: Permission[] = [{ resource_id: resource, resource_scopes: [writeScope] }];
    addRule({ action: 'http://www.w3.org/ns/odrl/2/append' });

    const result = await authorizer.permissions({}, writeQuery);

    expect(result).toEqual([]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });

  it('does not grant odrl:modify scope when rule only has odrl:write action', async () => {
    const modifyScope = 'urn:example:css:modes:write';
    const rawModifyQuery: Permission[] = [{ resource_id: resource, resource_scopes: ['http://www.w3.org/ns/odrl/2/modify'] }];
    addRule({ action: 'http://www.w3.org/ns/odrl/2/write' });

    const result = await authorizer.permissions({}, rawModifyQuery);

    expect(result).toEqual([]);
    expect(fallback.permissions).not.toHaveBeenCalled();
  });
});
