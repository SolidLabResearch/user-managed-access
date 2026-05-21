import { NotImplementedHttpError, RDF, XSD } from '@solid/community-server';
import { DataFactory as DF, Store } from 'n3';
import { Mocked } from 'vitest';
import { CLIENTID, WEBID } from '../../../../src/credentials/Claims';
import { OdrlAuthorizer } from '../../../../src/policies/authorizers/OdrlAuthorizer';
import { UCRulesStorage } from '../../../../src/ucp/storage/UCRulesStorage';
import { ODRL } from '../../../../src/ucp/util/Vocabularies';
import { Permission } from '../../../../src/views/Permission';

const now = new Date('2026-05-15T12:00:00.000Z');
vi.useFakeTimers({ now });

const CSS = {
  read: 'urn:example:css:modes:read',
  append: 'urn:example:css:modes:append',
  create: 'urn:example:css:modes:create',
  delete: 'urn:example:css:modes:delete',
  write: 'urn:example:css:modes:write',
};

describe('OdrlAuthorizer', (): void => {
  const webId = 'http://example.com/#me';
  let policyStore: Store;
  let policies: Mocked<UCRulesStorage>;
  let authorizer: OdrlAuthorizer;

  beforeEach(async(): Promise<void> => {
    vi.clearAllMocks();

    policyStore = new Store();
    policies = {
      getStore: vi.fn().mockResolvedValue(policyStore),
    } satisfies Partial<UCRulesStorage> as any;

    authorizer = new OdrlAuthorizer(policies, 'eye');
  });

  it('does not support credentials requests.', async(): Promise<void> => {
    await expect(authorizer.credentials([])).rejects.toThrow(NotImplementedHttpError);
  });

  it('returns an empty result if there is no query.', async(): Promise<void> => {
    await expect(authorizer.permissions({})).resolves.toEqual([]);
    expect(policies.getStore).toHaveBeenCalledTimes(0);
  });

  it('grants scopes matching assignee, action, and target.', async(): Promise<void> => {
    addPermission({
      policy: 'urn:policy',
      permission: 'urn:permission',
      actions: [ ODRL.read ],
      targets: [ 'rid' ],
      assignees: [ webId ],
    });

    await expect(authorizer.permissions({ [WEBID]: webId }, [
      { resource_id: 'rid', resource_scopes: [ CSS.read, CSS.write ] },
    ])).resolves.toEqual([{ resource_id: 'rid', resource_scopes: [ CSS.read ] }]);
    expect(policies.getStore).toHaveBeenCalledTimes(1);
  });

  it('does not grant scopes to a different assignee.', async(): Promise<void> => {
    addPermission({
      policy: 'urn:policy',
      permission: 'urn:permission',
      actions: [ ODRL.read ],
      targets: [ 'rid' ],
      assignees: [ 'http://other.example/#me' ],
    });

    await expect(authorizer.permissions({ [WEBID]: webId }, [
      { resource_id: 'rid', resource_scopes: [ CSS.read ] },
    ])).resolves.toEqual([{ resource_id: 'rid', resource_scopes: [] }]);
  });

  it('uses the anonymous subject when there is no WebID claim.', async(): Promise<void> => {
    addPermission({
      policy: 'urn:policy',
      permission: 'urn:permission',
      actions: [ ODRL.read ],
      targets: [ 'rid' ],
      assignees: [ 'urn:solidlab:uma:id:anonymous' ],
    });

    await expect(authorizer.permissions({}, [
      { resource_id: 'rid', resource_scopes: [ CSS.read ] },
    ])).resolves.toEqual([{ resource_id: 'rid', resource_scopes: [ CSS.read ] }]);
  });

  it('treats a Set policy without assignee as public.', async(): Promise<void> => {
    addPermission({
      policy: 'urn:policy',
      permission: 'urn:permission',
      policyType: ODRL.Set,
      actions: [ ODRL.read ],
      targets: [ 'rid' ],
      assignees: [],
    });

    await expect(authorizer.permissions({}, [
      { resource_id: 'rid', resource_scopes: [ CSS.read ] },
    ])).resolves.toEqual([{ resource_id: 'rid', resource_scopes: [ CSS.read ] }]);
  });

  it('treats odrl:modify as a CSS write grant for compatibility with existing policies.', async(): Promise<void> => {
    addPermission({
      policy: 'urn:policy',
      permission: 'urn:permission',
      actions: [ `${ODRL.namespace}modify` ],
      targets: [ 'rid' ],
      assignees: [ webId ],
    });

    await expect(authorizer.permissions({ [WEBID]: webId }, [
      { resource_id: 'rid', resource_scopes: [ CSS.write, CSS.read ] },
    ])).resolves.toEqual([{ resource_id: 'rid', resource_scopes: [ CSS.write ] }]);
  });

  it('grants all CSS scopes for odrl:use.', async(): Promise<void> => {
    addPermission({
      policy: 'urn:policy',
      permission: 'urn:permission',
      actions: [ `${ODRL.namespace}use` ],
      targets: [ 'rid' ],
      assignees: [ webId ],
    });

    await expect(authorizer.permissions({ [WEBID]: webId }, [
      { resource_id: 'rid', resource_scopes: [ CSS.read, CSS.append, CSS.create, CSS.delete, CSS.write ] },
    ])).resolves.toEqual([{
      resource_id: 'rid',
      resource_scopes: [ CSS.read, CSS.append, CSS.create, CSS.delete, CSS.write ],
    }]);
  });

  it('matches AssetCollection targets through odrl:partOf membership.', async(): Promise<void> => {
    addPermission({
      policy: 'urn:policy',
      permission: 'urn:permission',
      actions: [ ODRL.read ],
      targets: [ 'urn:collection' ],
      assignees: [ webId ],
    });
    policyStore.addQuads([
      DF.quad(DF.namedNode('urn:collection'), RDF.terms.type, ODRL.terms.AssetCollection),
      DF.quad(DF.namedNode('rid'), ODRL.terms.partOf, DF.namedNode('urn:collection')),
    ]);

    await expect(authorizer.permissions({ [WEBID]: webId }, [
      { resource_id: 'rid', resource_scopes: [ CSS.read ] },
    ])).resolves.toEqual([{ resource_id: 'rid', resource_scopes: [ CSS.read ] }]);
  });

  it('requires matching client IDs for purpose constraints.', async(): Promise<void> => {
    addPermission({
      policy: 'urn:policy',
      permission: 'urn:permission',
      actions: [ ODRL.read ],
      targets: [ 'rid' ],
      assignees: [ webId ],
      constraints: [{
        id: 'urn:constraint',
        leftOperand: ODRL.purpose,
        operator: ODRL.eq,
        rightOperand: DF.namedNode('http://example.com/client'),
      }],
    });

    const query = [{ resource_id: 'rid', resource_scopes: [ CSS.read ] }];
    await expect(authorizer.permissions({ [WEBID]: webId }, query))
      .resolves.toEqual([{ resource_id: 'rid', resource_scopes: [] }]);
    await expect(authorizer.permissions({ [WEBID]: webId, [CLIENTID]: 'http://example.com/client' }, query))
      .resolves.toEqual([{ resource_id: 'rid', resource_scopes: [ CSS.read ] }]);
  });

  it('evaluates dateTime constraints against the current time.', async(): Promise<void> => {
    addPermission({
      policy: 'urn:policy',
      permission: 'urn:permission',
      actions: [ ODRL.read ],
      targets: [ 'rid' ],
      assignees: [ webId ],
      constraints: [{
        id: 'urn:constraint',
        leftOperand: ODRL.dateTime,
        operator: ODRL.gt,
        rightOperand: DF.literal('2026-05-14T12:00:00.000Z', XSD.terms.dateTime),
      }],
    });

    await expect(authorizer.permissions({ [WEBID]: webId }, [
      { resource_id: 'rid', resource_scopes: [ CSS.read ] },
    ])).resolves.toEqual([{ resource_id: 'rid', resource_scopes: [ CSS.read ] }]);
  });

  it('handles many policies without per-scope external evaluator work.', async(): Promise<void> => {
    for (let i = 0; i < 1_000; i++) {
      addPermission({
        policy: `urn:policy:${i}`,
        permission: `urn:permission:${i}`,
        actions: [ i % 2 === 0 ? ODRL.read : ODRL.write ],
        targets: [ `urn:resource:${i}` ],
        assignees: [ webId ],
      });
    }
    const query: Permission[] = Array.from({ length: 100 }, (_, i) => ({
      resource_id: `urn:resource:${i}`,
      resource_scopes: [ CSS.read, CSS.write ],
    }));

    const started = performance.now();
    const result = await authorizer.permissions({ [WEBID]: webId }, query);
    const elapsed = performance.now() - started;

    expect(result).toHaveLength(100);
    expect(result[0]).toEqual({ resource_id: 'urn:resource:0', resource_scopes: [ CSS.read ] });
    expect(result[1]).toEqual({ resource_id: 'urn:resource:1', resource_scopes: [ CSS.write ] });
    expect(policies.getStore).toHaveBeenCalledTimes(1);
    expect(elapsed).toBeLessThan(1_000);
  });

  function addPermission(input: {
    policy: string;
    permission: string;
    policyType?: string;
    actions: string[];
    targets: string[];
    assignees: string[];
    constraints?: {
      id: string;
      leftOperand: string;
      operator: string;
      rightOperand: ReturnType<typeof DF.namedNode> | ReturnType<typeof DF.literal>;
    }[];
  }): void {
    const policy = DF.namedNode(input.policy);
    const permission = DF.namedNode(input.permission);

    policyStore.addQuads([
      DF.quad(policy, RDF.terms.type, DF.namedNode(input.policyType ?? ODRL.Agreement)),
      DF.quad(policy, ODRL.terms.permission, permission),
      DF.quad(permission, RDF.terms.type, ODRL.terms.Permission),
      ...input.actions.map((action) => DF.quad(permission, ODRL.terms.action, DF.namedNode(action))),
      ...input.targets.map((target) => DF.quad(permission, ODRL.terms.target, DF.namedNode(target))),
      ...input.assignees.map((assignee) => DF.quad(permission, ODRL.terms.assignee, DF.namedNode(assignee))),
    ]);

    for (const constraintInput of input.constraints ?? []) {
      const constraint = DF.namedNode(constraintInput.id);
      policyStore.addQuads([
        DF.quad(permission, ODRL.terms.constraint, constraint),
        DF.quad(constraint, ODRL.terms.leftOperand, DF.namedNode(constraintInput.leftOperand)),
        DF.quad(constraint, ODRL.terms.operator, DF.namedNode(constraintInput.operator)),
        DF.quad(constraint, ODRL.terms.rightOperand, constraintInput.rightOperand),
      ]);
    }
  }
});
