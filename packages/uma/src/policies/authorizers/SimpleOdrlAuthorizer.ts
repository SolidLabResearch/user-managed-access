import { NamedNode, Term } from '@rdfjs/types';
import { getLoggerFor } from 'global-logger-factory';
import jp from 'jsonpath';
import { DataFactory as DF, Quad_Object, Quad_Subject } from 'n3';
import { ODRL } from 'odrl-evaluator';
import { CLIENTID, VC, WEBID } from '../../credentials/Claims';
import { ClaimSet } from '../../credentials/ClaimSet';
import { ReadOnlyStore, UCRulesStorage } from '../../ucp/storage/UCRulesStorage';
import { OVC } from '../../ucp/util/Vocabularies';
import { Permission } from '../../views/Permission';
import { Authorizer } from './Authorizer';

const ANONYMOUS = DF.namedNode('urn:solidlab:uma:id:anonymous');

// TODO: Copied from ODRL Authorizer.
//       Should be handled by RS.
const scopeCssToOdrl: Map<string, string> = new Map();
scopeCssToOdrl.set('urn:example:css:modes:read','http://www.w3.org/ns/odrl/2/read');
scopeCssToOdrl.set('urn:example:css:modes:append','http://www.w3.org/ns/odrl/2/append');
scopeCssToOdrl.set('urn:example:css:modes:create','http://www.w3.org/ns/odrl/2/create');
scopeCssToOdrl.set('urn:example:css:modes:delete','http://www.w3.org/ns/odrl/2/delete');
scopeCssToOdrl.set('urn:example:css:modes:write','http://www.w3.org/ns/odrl/2/write');

const dateComparators: NodeJS.Dict<(a: Date, b: Date) => boolean> = {
  [ODRL.lt]: (a: Date, b: Date) => a < b,
  [ODRL.lteq]: (a: Date, b: Date) => a <= b,
  [ODRL.eq]: (a: Date, b: Date) => a === b,
  [ODRL.gt]: (a: Date, b: Date) => a > b,
  [ODRL.gteq]: (a: Date, b: Date) => a >= b,
};

const claimOperandMap: Record<string, string> = {
  [ODRL.deliveryChannel]: CLIENTID,
} as const;

interface PolicyData {
  store: ReadOnlyStore;
  lists: Readonly<Record<string, Term[]>>;
  claims: Readonly<ClaimSet>;
}

/**
 * A simple authorizer that can handle basic ODRL policies with direct permissions and prohibitions,
 * without any complex constraints or inheritance.
 * If a request doesn't match any permission or prohibition
 * in the policies it evaluates, it falls back to a provided authorizer.
 */
export class SimpleOdrlAuthorizer implements Authorizer {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    protected readonly policies: UCRulesStorage,
    protected readonly authorizer: Authorizer,
  ) {}

  public async permissions(claims: ClaimSet, query?: Permission[]): Promise<Permission[]> {
    if (!query) {
      return this.authorizer.permissions(claims, query);
    }

    const store = await this.policies.getStore();
    const lists = store.extractLists();

    const data: PolicyData = { store, lists, claims };

    let permissions: Permission[] = [];
    for (const { resource_id, resource_scopes } of query) {
      const allowedScopes: string[] = [];
      for (const scope of resource_scopes) {
        const result = this.getPermissions(data, resource_id, scope);
        if (!result) {
          // Too difficult to handle internally so need to call complete authorizer
          return this.authorizer.permissions(claims, query);
        }

        allowedScopes.push(...result);
      }
      if (allowedScopes.length > 0) {
        permissions.push({
          resource_id,
          resource_scopes: allowedScopes,
        });
      }
    }
    return permissions;
  }

  protected getPermissions(data: PolicyData, resource: string, scope: string):
    string[] | undefined {
    this.logger.info(`Evaluating Request ${scope}, ${resource} with claims ${JSON.stringify(data.claims)}`);
    const targets = [ DF.namedNode(resource), ...data.store.getObjects(resource, ODRL.terms.partOf, null)];
    let rules = targets.flatMap(target => data.store.getSubjects(ODRL.terms.target, target, null));
    if (rules.length === 0) {
      this.logger.warn('Rejecting request because no rules with a matching target or asset collection were found');
      return [];
    }

    let revertScopeToCssMode = scope.startsWith('urn:example:css:modes:');
    const oldScope = scope;
    if (revertScopeToCssMode) {
      scope = scopeCssToOdrl.get(scope) ?? scope;
    }

    // Note that this only catches this specific super action
    const superAction = scope === ODRL.append || scope === ODRL.write ? ODRL.terms.modify : undefined;
    rules = rules.filter(rule =>
      data.store.has(DF.quad(rule, ODRL.terms.action, DF.namedNode(scope))) ||
      (superAction !== undefined && data.store.has(DF.quad(rule, ODRL.terms.action, superAction)))
    );
    if (rules.length === 0) {
      this.logger.warn('Rejecting request because no rules with a matching action were found');
      return [];
    }

    let assignees: NamedNode[] = [ ANONYMOUS ];
    for (const user of data.claims[WEBID] ?? []) {
      if (typeof user === 'string') {
        const userNode = DF.namedNode(user);
        assignees.push(userNode);
        assignees.push(...(data.store.getObjects(user, ODRL.terms.partOf, null) as NamedNode[]));
      }
    }
    rules = rules.filter(rule => {
      const ruleAssignees = data.store.getObjects(rule, ODRL.terms.assignee, null);
      if (ruleAssignees.length === 0) {
        // Public access
        return true;
      }
      return ruleAssignees.some(ruleAssignee => assignees.some(assignee => assignee.equals(ruleAssignee)));
    });
    if (rules.length === 0) {
      this.logger.warn('Rejecting request because no rules with a matching assignee or party collection were found');
      return [];
    }

    // Check simple constraints
    const validRules: Quad_Subject[] = [];
    for (const rule of rules) {
      const constraintResponse = this.validateConstraints(rule, data);
      const vcConstraintResponse = this.validateOvcConstraints(rule, data);
      if (constraintResponse && vcConstraintResponse) {
        validRules.push(rule);
      } else if (constraintResponse === undefined || vcConstraintResponse === undefined) {
        return;
      }
    }
    if (validRules.length === 0) {
      this.logger.warn('Rejecting request because no rules with fulfilled constraints were found');
      return [];
    }

    const predicates = validRules.map(rule => data.store.getPredicates(null, rule, null));
    for (const rulePredicates of predicates) {
      if (rulePredicates.length === 0) {
        return;
      }
      if (rulePredicates.some(predicate => predicate.equals(ODRL.terms.prohibition))) {
        this.logger.warn('Rejecting request because matching prohibitions were found');
        return [];
      }
      // This implies we have an unsupported type of rule
      if (!rulePredicates.some(predicate => predicate.equals(ODRL.terms.permission))) {
        return;
      }
    }

    return [ oldScope ];
  }

  // TODO: 3 modes: valid, not valid, too complicated
  /**
   * Determines if all constraints for the given rule are valid.
   * Returns true if all constraints are valid, false if any constraint is not valid,
   * and undefined if any constraint is too complex to evaluate.
   * Only supports deliveryChannel (for client ID), purpose, and dateTime constraints.
   */
  protected validateConstraints(rule: Quad_Subject, data: PolicyData): boolean | undefined {
    const constraints = data.store.getObjects(rule, ODRL.terms.constraint, null).map(constraint => ({
      leftOperand: data.store.getObjects(constraint, ODRL.terms.leftOperand, null)[0],
      operator: data.store.getObjects(constraint, ODRL.terms.operator, null)[0],
      rightOperand: data.store.getObjects(constraint, ODRL.terms.rightOperand, null)[0],
    }));
    // If any of these are undefined this is too complex to handle here
    if (constraints.some(({ leftOperand, operator, rightOperand }) => !leftOperand || !operator || !rightOperand)) {
      return;
    }
    // TODO: would want middleware step where credentials and other stuff are already extracted into RDF values
    //       so both ODRL authorizers don't have to bother with this
    for (const constraint of constraints) {
      // Return undefined if any of these are too complex or unknown
      if (constraint.leftOperand.equals(ODRL.terms.dateTime)) {
        const comparisonDate = new Date(constraint.rightOperand.value);
        const comparator = dateComparators[constraint.operator.value];
        if (!comparator) {
          return false;
        }
        if (!comparator(new Date(), comparisonDate)) {
          return false;
        }
      } else {
        const claimKey = claimOperandMap[constraint.leftOperand.value] ?? constraint.leftOperand.value;
        const claimValues = data.claims[claimKey];
        const rightValues = data.lists[constraint.rightOperand.value] ?? [constraint.rightOperand];
        const result = this.verifyConstraint(claimValues ?? [], constraint.operator, rightValues);
        // Catches both false and undefined
        if (!result) {
          return result;
        }
      }
    }
    return true;
  }

  // https://gitlab.com/gaia-x/lab/policy-reasoning/odrl-vc-profile
  protected validateOvcConstraints(rule: Quad_Subject, data: PolicyData): boolean | undefined {
    const constraints = data.store.getObjects(rule, OVC.terms.constraint, null).map(constraint => ({
      leftOperand: data.store.getObjects(constraint, OVC.terms.leftOperand, null)[0],
      operator: data.store.getObjects(constraint, ODRL.terms.operator, null)[0],
      rightOperand: data.store.getObjects(constraint, ODRL.terms.rightOperand, null)[0],
      credentialSubjectType: data.store.getObjects(constraint, OVC.terms.credentialSubjectType, null)[0],
    }));
    // If any of these are undefined this is too complex to handle here (credentialSubjectType can be undefined)
    if (constraints.some(({ leftOperand, operator, rightOperand }) => !leftOperand || !operator || !rightOperand)) {
      return;
    }
    if (constraints.length === 0) {
      return true;
    }
    // Can't match a VC constraint if there is no VC input
    const vcs = data.claims[VC];
    if (!vcs || vcs?.length === 0) {
      return false;
    }

    for (const constraint of constraints) {
      const foundMatchedVc = vcs.some(vc => {
        const results = jp.query(vc, constraint.leftOperand.value).flat();
        const rightValues = data.lists[constraint.rightOperand.value] ?? [constraint.rightOperand];
        const result = this.verifyConstraint(results, constraint.operator, rightValues);
        // Catches both false and undefined
        if (!result) {
          return result;
        }
        if (constraint.credentialSubjectType) {
          const types = jp.query(vc, '$.type').flat();
          if (!types.some(typ => constraint.credentialSubjectType.value === typ)) {
            return false;
          }
        }
        return true;
      });
      if (!foundMatchedVc) {
        return false;
      }
    }

    return true;
  }

  protected verifyConstraint(left: unknown[], operator: Quad_Object, right: Term[]): boolean | undefined {
    if (left.length === 0 || right.length === 0) {
      return;
    }

    const leftStrings = left.map(val => {
      if (typeof val === 'string') {
        return val;
      }
      if (typeof (val as { value: unknown }).value === 'string') {
        return (val as { value: string }).value;
      }
      return;
    }).filter((val): val is string => val !== undefined);
    const rightStrings = right.map(term => term.value);

    // TODO: Not supporting more than 1 left value until we have decided on the semantics
    if (leftStrings.length > 1) {
      return;
    }
    const leftString = leftStrings[0];

    if (operator) {
      switch (operator.value) {
        case ODRL.eq:
          if (rightStrings.length > 1) {
            return;
          }
          return leftString === rightStrings[0];
        case ODRL.neq:
          if (rightStrings.length > 1) {
            return;
          }
          return leftString !== rightStrings[0];
        case ODRL.isAnyOf:
          return rightStrings.includes(leftString);
        case ODRL.isNoneOf:
          return !rightStrings.includes(leftString);
        default:
            return;
      }
    }
  }
}
