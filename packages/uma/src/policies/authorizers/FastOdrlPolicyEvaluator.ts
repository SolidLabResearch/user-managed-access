import { RDF, XSD } from '@solid/community-server';
import { DataFactory, NamedNode, Quad_Object, Quad_Subject, Store } from 'n3';
import { CLIENTID, WEBID } from '../../credentials/Claims';
import { ClaimSet } from '../../credentials/ClaimSet';
import { ODRL } from '../../ucp/util/Vocabularies';

const { namedNode } = DataFactory;

export const ANONYMOUS_WEBID = 'urn:solidlab:uma:id:anonymous';
const ODRL_MODIFY = `${ODRL.namespace}modify`;
const ODRL_USE = `${ODRL.namespace}use`;

type EvaluationContext = {
  subject: string;
  clientId?: string;
  now: Date;
};

type IndexedPermission = {
  publicSet: boolean;
  assignees: string[];
  actions: string[];
  targets: NamedNode[];
  constraints: Quad_Object[];
};

/**
 * Minimal ODRL evaluator for the subset currently used by the UMA authorizer.
 *
 * It supports Permission rules linked from Agreement/Set policies, assignee matching,
 * exact action/target matching, Set policies without assignee as public rules,
 * AssetCollection membership through odrl:partOf, and simple eq/gt/lt constraints
 * for purpose and dateTime.
 */
export class FastOdrlPolicyEvaluator {
  public createIndex(store: Store): FastOdrlPolicyIndex {
    return new FastOdrlPolicyIndex(store, this.indexPermissions(store));
  }

  protected indexPermissions(store: Store): IndexedPermission[] {
    const permissions: IndexedPermission[] = [];
    const policies = [
      ...store.getSubjects(RDF.terms.type, ODRL.terms.Agreement, null),
      ...store.getSubjects(RDF.terms.type, ODRL.terms.Set, null),
    ];
    const seen = new Set<string>();

    for (const policy of policies) {
      if (seen.has(policy.id)) {
        continue;
      }
      seen.add(policy.id);

      const isSetPolicy = store.has(DataFactory.quad(policy, RDF.terms.type, ODRL.terms.Set));
      for (const permission of store.getObjects(policy, ODRL.terms.permission, null)) {
        if (!this.isNamedNode(permission) || !this.isPermission(store, permission)) {
          continue;
        }

        permissions.push({
          publicSet: isSetPolicy,
          assignees: store.getObjects(permission, ODRL.terms.assignee, null)
            .filter((assignee): assignee is NamedNode => assignee.termType === 'NamedNode')
            .map((assignee) => assignee.value),
          actions: store.getObjects(permission, ODRL.terms.action, null)
            .filter((action): action is NamedNode => action.termType === 'NamedNode')
            .map((action) => action.value),
          targets: store.getObjects(permission, ODRL.terms.target, null)
            .filter((target): target is NamedNode => target.termType === 'NamedNode'),
          constraints: store.getObjects(permission, ODRL.terms.constraint, null),
        });
      }
    }

    return permissions;
  }

  protected isNamedNode(term: Quad_Object | Quad_Subject): term is NamedNode {
    return term.termType === 'NamedNode';
  }

  protected isPermission(store: Store, permission: NamedNode): boolean {
    return store.countQuads(permission, RDF.terms.type, ODRL.terms.Permission, null) > 0;
  }
}

export class FastOdrlPolicyIndex {
  private readonly permissionsByAction = new Map<string, IndexedPermission[]>();
  private readonly usePermissions: IndexedPermission[] = [];

  public constructor(
    private readonly store: Store,
    permissions: IndexedPermission[],
  ) {
    for (const permission of permissions) {
      for (const action of permission.actions) {
        if (action === ODRL_USE) {
          this.usePermissions.push(permission);
          continue;
        }

        const actionPermissions = this.permissionsByAction.get(action);
        if (actionPermissions) {
          actionPermissions.push(permission);
        } else {
          this.permissionsByAction.set(action, [ permission ]);
        }
      }
    }
  }

  public evaluate(claims: ClaimSet, resourceId: string, requestedAction: string): boolean {
    const context = this.createContext(claims);
    const resource = namedNode(resourceId);
    const candidates = [
      ...this.permissionsByAction.get(requestedAction) ?? [],
      ...requestedAction === ODRL.write ? this.permissionsByAction.get(ODRL_MODIFY) ?? [] : [],
      ...this.usePermissions,
    ];

    return candidates.some((permission) =>
      this.matchesAssignee(permission, context.subject) &&
      this.matchesTarget(permission, resource) &&
      this.matchesConstraints(permission, context)
    );
  }

  protected createContext(claims: ClaimSet): EvaluationContext {
    return {
      subject: typeof claims[WEBID] === 'string' ? claims[WEBID] : ANONYMOUS_WEBID,
      clientId: typeof claims[CLIENTID] === 'string' ? claims[CLIENTID] : undefined,
      now: new Date(),
    };
  }

  protected isNamedNode(term: Quad_Object | Quad_Subject): term is NamedNode {
    return term.termType === 'NamedNode';
  }

  protected matchesAssignee(permission: IndexedPermission, subject: string): boolean {
    if (permission.publicSet && permission.assignees.length === 0) {
      return true;
    }
    return permission.assignees.includes(subject);
  }

  protected matchesTarget(permission: IndexedPermission, resource: NamedNode): boolean {
    return permission.targets.some((target) => {
      if (target.equals(resource)) {
        return true;
      }
      return this.isAssetCollection(target) && this.isPartOfCollection(resource, target);
    });
  }

  protected isAssetCollection(target: NamedNode): boolean {
    return this.store.countQuads(target, RDF.terms.type, ODRL.terms.AssetCollection, null) > 0;
  }

  protected isPartOfCollection(resource: NamedNode, collection: NamedNode): boolean {
    const visited = new Set<string>();
    const pending: NamedNode[] = [ resource ];

    while (pending.length > 0) {
      const current = pending.pop()!;
      if (visited.has(current.value)) {
        continue;
      }
      visited.add(current.value);

      for (const parent of this.store.getObjects(current, ODRL.terms.partOf, null)) {
        if (parent.termType !== 'NamedNode') {
          continue;
        }
        if (parent.equals(collection)) {
          return true;
        }
        pending.push(parent);
      }
    }

    return false;
  }

  protected matchesConstraints(permission: IndexedPermission, context: EvaluationContext): boolean {
    return permission.constraints.every((constraint) => this.matchesConstraint(constraint, context));
  }

  protected matchesConstraint(constraint: Quad_Object, context: EvaluationContext): boolean {
    if (!this.isNamedNode(constraint)) {
      return false;
    }

    const leftOperand = this.store.getObjects(constraint, ODRL.terms.leftOperand, null)[0];
    const operator = this.store.getObjects(constraint, ODRL.terms.operator, null)[0];
    const rightOperand = this.store.getObjects(constraint, ODRL.terms.rightOperand, null)[0];
    if (!leftOperand || !operator || !rightOperand || operator.termType !== 'NamedNode') {
      return false;
    }

    if (leftOperand.equals(ODRL.terms.purpose)) {
      return typeof context.clientId === 'string' &&
        this.compareString(context.clientId, operator.value, rightOperand.value);
    }
    if (leftOperand.equals(ODRL.terms.dateTime)) {
      return this.compareDate(context.now, operator.value, rightOperand);
    }

    return false;
  }

  protected compareString(actual: string, operator: string, expected: string): boolean {
    return operator === ODRL.eq && actual === expected;
  }

  protected compareDate(actual: Date, operator: string, expected: Quad_Object): boolean {
    if (expected.termType !== 'Literal' || !expected.datatype.equals(XSD.terms.dateTime)) {
      return false;
    }
    const actualTime = actual.getTime();
    const expectedTime = Date.parse(expected.value);
    if (Number.isNaN(expectedTime)) {
      return false;
    }
    switch (operator) {
      case ODRL.gt: return actualTime > expectedTime;
      case ODRL.lt: return actualTime < expectedTime;
      case ODRL.eq: return actualTime === expectedTime;
      default: return false;
    }
  }
}
