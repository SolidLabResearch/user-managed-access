import { NamedNode } from '@rdfjs/types';
import { getLoggerFor } from 'global-logger-factory';
import { DataFactory as DF, Quad_Subject, Store } from 'n3';
import { ODRL } from 'odrl-evaluator';
import { CLIENTID, WEBID } from '../../credentials/Claims';
import { ClaimSet } from '../../credentials/ClaimSet';
import { ReadOnlyStore, UCRulesStorage } from '../../ucp/storage/UCRulesStorage';
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

    let permissions: Permission[] = [];
    for (const { resource_id, resource_scopes } of query) {
      for (const scope of resource_scopes) {
        const result = this.getPermissions(store, claims, resource_id, scope);
        if (!result) {
          // Too difficult to handle internally so need to call complete authorizer
          return this.authorizer.permissions(claims, query);
        }

        permissions.push(...result);
      }
    }
    return permissions;
  }

  protected getPermissions(policies: ReadOnlyStore, claims: ClaimSet, resource: string, scope: string):
    Permission[] | undefined {
    this.logger.info(`Evaluating Request ${scope}, ${resource} with claims ${JSON.stringify(claims)}`);
    const targets = [ DF.namedNode(resource), ...policies.getObjects(resource, ODRL.terms.partOf, null)];
    let rules = targets.flatMap(target => policies.getSubjects(ODRL.terms.target, target, null));
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
      policies.has(DF.quad(rule, ODRL.terms.action, DF.namedNode(scope))) ||
      (superAction !== undefined && policies.has(DF.quad(rule, ODRL.terms.action, superAction)))
    );
    if (rules.length === 0) {
      this.logger.warn('Rejecting request because no rules with a matching action were found');
      return [];
    }

    let user = claims[WEBID];
    let assignees: NamedNode[] = [ ANONYMOUS ];
    if (typeof user === 'string') {
      const userNode = DF.namedNode(user);
      assignees.push(userNode);
      assignees.push(...(policies.getObjects(user, ODRL.terms.partOf, null) as NamedNode[]));
    }
    rules = rules.filter(rule => {
      const ruleAssignees = policies.getObjects(rule, ODRL.terms.assignee, null);
      if (ruleAssignees.length === 0) {
        // Public access
        return true;
      }
      return ruleAssignees.some(ruleAssignee => assignees.some(assignee => assignee.equals(ruleAssignee)));
    });
    this.logger.warn('Rejecting request because no rules with a matching assignee or party collection were found');
    if (rules.length === 0) {
      return [];
    }

    // Check simple constraints
    const validRules: Quad_Subject[] = [];
    for (const rule of rules) {
      const constraintResponse = this.validateConstraints(rule, policies, claims);
      if (constraintResponse === true) {
        validRules.push(rule);
      } else if (constraintResponse === undefined) {
        return;
      }
    }
    if (validRules.length === 0) {
      this.logger.warn('Rejecting request because no rules with fulfilled constraints were found');
      return [];
    }

    const predicates = validRules.map(rule => policies.getPredicates(null, rule, null));
    for (const rulePredicates of predicates) {
      if (rulePredicates.length === 0) {
        return;
      }
      if (rulePredicates.some(predicate => predicate.equals(ODRL.terms.prohibition))) {
        this.logger.warn('Rejecting request because only matching prohibitions were found');
        return [];
      }
      // This implies we have an unsupported type of rule
      if (!rulePredicates.some(predicate => predicate.equals(ODRL.terms.permission))) {
        return;
      }
    }

    return [{
      resource_id: resource,
      resource_scopes: [ oldScope ],
    }];
  }

  // TODO: 3 modes: valid, not valid, too complicated
  /**
   * Determines if all constraints for the given rule are valid.
   * Returns true if all constraints are valid, false if any constraint is not valid,
   * and undefined if any constraint is too complex to evaluate.
   * Only supports purpose (for client ID) and dateTime constraints.
   */
  protected validateConstraints(rule: Quad_Subject, policies: ReadOnlyStore, claims: ClaimSet): boolean | undefined {
    const constraints = policies.getObjects(rule, ODRL.terms.constraint, null).map(constraint => ({
      leftOperand: policies.getObjects(constraint, ODRL.terms.leftOperand, null)[0],
      operator: policies.getObjects(constraint, ODRL.terms.operator, null)[0],
      rightOperand: policies.getObjects(constraint, ODRL.terms.rightOperand, null)[0],
    }));
    // If any of these are undefined this is too complex to handle here
    if (constraints.some(({ leftOperand, operator, rightOperand }) => !leftOperand || !operator || !rightOperand)) {
      return;
    }
    for (const constraint of constraints) {
      // Return undefined if any of these are too complex or unknown
      // TODO: because of weird hack described in OdrlAuthorizer, needs to change to term that makes more sense
      if (constraint.leftOperand.equals(ODRL.terms.purpose)) {
        if (!constraint.operator.equals(ODRL.terms.eq)) {
          return false;
        }
        const clientId = claims[CLIENTID];
        if (typeof clientId !== 'string' || constraint.rightOperand.value !== clientId) {
          return false;
        }
      } else if (constraint.leftOperand.equals(ODRL.terms.dateTime)) {
        const comparisonDate = new Date(constraint.rightOperand.value);
        const comparator = dateComparators[constraint.operator.value];
        if (!comparator) {
          return false;
        }
        if (!comparator(new Date(), comparisonDate)) {
          return false;
        }
      } else {
        // Unsupported constraint
        return;
      }
    }
    return true;
  }
}
