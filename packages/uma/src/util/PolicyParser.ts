import { Quad, Term } from '@rdfjs/types';
import { BadRequestHttpError } from '@solid/community-server';
import { DataFactory as DF, Quad_Subject, Store } from 'n3';
import { ODRL } from 'odrl-evaluator';
import { DC, RDF } from '../ucp/util/Vocabularies';

const COMPACT_VALUE_PREDICATES = [
  ODRL.action,
  ODRL.target,
  ODRL.assigner,
  ODRL.assignee,
] as const;

const RECURSIVE_RULE_REFERENCES = [
  ODRL.terms.consequence,
  ODRL.terms.duty,
  ODRL.terms.remedy,
] as const;

const SUB_RULE_MAP: Record<string, Term[]> = {
  [ODRL.permission]: [ ODRL.terms.duty ],
  [ODRL.prohibition]: [ ODRL.terms.remedy ],
  [ODRL.obligation]: [ ODRL.terms.consequence ],
  [ODRL.duty]: [ ODRL.terms.consequence ],
} as const;

const LOGICAL_CONSTRAINT_OPERATORS = [
  ODRL.terms.and,
  ODRL.terms.andSequence,
  ODRL.terms.or,
  ODRL.terms.xone,
] as const;

type CompactValues = { [P in typeof COMPACT_VALUE_PREDICATES[number]]?: Term[] };

export type ParsedPolicy = {
  root: Quad_Subject,
  quads: Quad[],
  nodes: Term[],
  ruleData: { targets: Term[], assigners: Term[], actions: Term[] }[]
}

// TODO: utility class for PolicyRequestController, new entry per request
export class PolicyParser {
  // TODO: could also have function to reset stuff, but might as well just make new object
  public constructor(
    // TODO: user part could also be done outside of this parser, which would let this class focus on just the parsing (and at that point does it still need to be a class?)
    protected readonly input: Store,
  ) {}

  public doStuffTODO(id?: Term): ParsedPolicy {
    // Always add creator to policy for easier ownership checks later
    const result = this.filterPolicy(id);
    result.quads.push(...this.filterPolicyMetadata(result.root));
    return result;
  }

  protected filterPolicy(id?: Term): ParsedPolicy {
    let policyNode = id;
    let policyTypes: Quad[] = [];
    if (policyNode) {
      // Only filter out the requested id
      policyTypes = this.input.getQuads(policyNode, RDF.terms.type, null, null);
    } else {
      policyTypes = [
        ...this.input.getQuads(null, RDF.terms.type, ODRL.terms.Set, null),
        ...this.input.getQuads(null, RDF.terms.type, ODRL.terms.Offer, null),
        ...this.input.getQuads(null, RDF.terms.type, ODRL.terms.Agreement, null),
      ];
      if (policyTypes.length !== 1) {
        throw new BadRequestHttpError(`Expected exactly one policy, found the following: [${
          policyTypes.map(quad => quad.subject.value).join(',')}]`);
      }

      policyNode = policyTypes[0].subject;
    }
    const result: ParsedPolicy = {
      root: policyNode as Quad_Subject,
      nodes: [ policyNode ],
      quads: policyTypes,
      ruleData: [],
    };

    const uids = this.input.getQuads(policyNode, ODRL.terms.uid, null, null);
    if (uids.length !== 1 || !uids[0].object.equals(policyNode)) {
      throw new BadRequestHttpError('Policy requires exactly 1 odrl:uid matching the subject node');
    }
    result.quads.push(uids[0]);

    const rules = [
      ...this.input.getQuads(null, ODRL.terms.permission, null, null),
      ...this.input.getQuads(null, ODRL.terms.prohibition, null, null),
      ...this.input.getQuads(null, ODRL.terms.obligation, null, null),
    ];
    // TODO: something among the set of things to recheck after patch
    if (rules.length === 0) {
      throw new BadRequestHttpError(`Could not find rules for policy ${policyNode.value}`);
    }
    result.quads.push(...rules);

    let compactValues: CompactValues = {};
    for (const term of COMPACT_VALUE_PREDICATES) {
      const matches = this.input.getQuads(policyNode, term, null, null);
      compactValues[term] = [];
      for (const match of matches) {
        compactValues[term].push(match.object);
        result.quads.push(match);
        const partialResult = this.filterPotentiallyRefinedTerm(match.object);
        result.quads.push(...partialResult.quads);
        result.nodes.push(...partialResult.nodes);
      }
    }

    for (const term of [ ODRL.terms.profile, ODRL.terms.inheritFrom, ODRL.terms.conflict ]) {
      if (this.input.countQuads(policyNode, term, null, null) > 0) {
        throw new BadRequestHttpError(`${term.value} is not supported`);
      }
    }

    for (const ruleQuad of rules) {
      const partialResult = this.filterRule(ruleQuad, policyTypes[0].object, compactValues);
      result.quads.push(...partialResult.quads);
      result.nodes.push(...partialResult.nodes);
      if (partialResult.ruleEntry) {
        result.ruleData.push(partialResult.ruleEntry);
      }
    }

    return result;
  }

  // TODO: object of ruleQuad is rule node, using quad as we also need the predicate to determine valid contents
  protected filterRule(ruleQuad: Quad, parentType: Term, compactValues: CompactValues = {},
    cache = new Set<string>()): { quads: Quad[], nodes: Term[], ruleEntry?: ParsedPolicy['ruleData'][number] } {
    // TODO: compact policies would require re-checking if everything is valid after a PATCH

    // Prevent potential infinite loops
    const ruleNode = ruleQuad.object;
    if (cache.has(ruleNode.value)) {
      return { quads: [], nodes: [] };
    }
    cache.add(ruleNode.value);

    const result: ReturnType<typeof this.filterRule> = { quads: [], nodes: [ ruleNode ] };
    let ruleValues: CompactValues = {};
    for (const predicate of COMPACT_VALUE_PREDICATES) {
      const matches = this.input.getQuads(ruleNode, predicate, null, null);
      ruleValues[predicate] = matches.map(quad => quad.object);
      result.quads.push(...matches);
      for (const value of ruleValues[predicate]) {
        const partialResult = this.filterPotentiallyRefinedTerm(value);
        result.quads.push(...partialResult.quads);
        result.nodes.push(...partialResult.nodes);
      }
    }
    // Merge with provided compact values
    for (const [key, terms] of Object.entries(compactValues) as [keyof CompactValues, Term[]][]) {
      if (ruleValues[key]) {
        ruleValues[key].push(...terms);
      } else {
        ruleValues[key] = [...terms];
      }
    }

    // Validate type requirements
    if (!ruleValues[ODRL.target]?.length || !ruleValues[ODRL.action]?.length) {
      throw new BadRequestHttpError('Rules need at least 1 target and action');
    }
    if (parentType.equals(ODRL.terms.Offer) && !ruleValues[ODRL.assigner]?.length) {
      throw new BadRequestHttpError('Offer rules require at least 1 assigner');
    }
    if (parentType.equals(ODRL.terms.Agreement)) {
      if (!ruleValues[ODRL.assigner]?.length || !ruleValues[ODRL.assignee]?.length) {
        throw new BadRequestHttpError('Offer rules require at least 1 assigner and assignee');
      }
    }
    const uidQuads = this.input.getQuads(ruleNode, ODRL.terms.uid, null, null);
    if (uidQuads.length > 1 || (uidQuads.length === 1 &&!uidQuads[0].object.equals(ruleNode))) {
      throw new BadRequestHttpError(
        `Rules can only have a single odrl:uid triple that needs to match the rule node`);
    }
    result.quads.push(...uidQuads);

    // Constraints
    for (const match of this.input.getQuads(ruleNode, ODRL.terms.constraint, null, null)) {
      result.quads.push(match);
      const partialResult = this.filterConstraint(match.object);
      result.quads.push(...partialResult.quads);
      result.nodes.push(...partialResult.nodes);
    }

    // Recursive rule predicates
    for (const predicate of RECURSIVE_RULE_REFERENCES) {
      for (const match of this.input.getQuads(ruleNode, predicate, null, null)) {
        const allowed = SUB_RULE_MAP[ruleQuad.predicate.value] ?? [];
        if (!allowed.some(term => term.equals(predicate))) {
          throw new BadRequestHttpError(`${predicate.value} is not allowed in ${ruleQuad.predicate.value} rules`);
        }
        result.quads.push(match);
        const partialResult = this.filterRule(match, predicate as Term, ruleValues, cache);
        result.quads.push(...partialResult.quads);
        result.nodes.push(...partialResult.nodes);
      }
    }

    result.ruleEntry = {
      assigners: ruleValues[ODRL.assigner] ?? [],
      actions: ruleValues[ODRL.action] ?? [],
      targets: ruleValues[ODRL.target] ?? [],
    }

    return result;
  }

  protected filterPotentiallyRefinedTerm(node: Term): { quads: Quad[], nodes: Term[] } {
    const result: { quads: Quad[], nodes: Term[] } = { quads: [], nodes: [ node ] };

    if (this.input.countQuads(node, ODRL.terms.refinement, null, null) === 0) {
      return { quads: [], nodes: [] };
    }

    const valueMatch = this.input.getQuads(node, RDF.terms.value, null, null);
    if (valueMatch.length !== 1) {
      throw new BadRequestHttpError(`Expected 1 rdf:value for refinement ${node.value}`);
    }
    result.quads.push(valueMatch[0]);

    for (const match of this.input.getQuads(node, ODRL.terms.refinement, null, null)) {
      result.quads.push(match);
      const partialResult = this.filterConstraint(match.object);
      result.quads.push(...partialResult.quads);
      result.nodes.push(...partialResult.nodes);
    }

    return result;
  }

  protected filterConstraint(constraintNode: Term): { quads: Quad[], nodes: Term[] } {
    const result: { quads: Quad[], nodes: Term[] } = { quads: [], nodes: [ constraintNode ] };

    // One operator can have matches if it is a logical constraint
    let logicalOperator: Term | undefined;
    for (const op of LOGICAL_CONSTRAINT_OPERATORS) {
      const matches = this.input.getQuads(constraintNode, op, null, null);
      if (matches.length > 0) {
        if (logicalOperator) {
          throw new BadRequestHttpError('Logical constraints can only have 1 operator');
        }
        logicalOperator = op;
        result.quads.push(...matches);
        for (const match of matches) {
          const partialResult = this.filterConstraint(match.object);
          result.quads.push(...partialResult.quads);
          result.nodes.push(...partialResult.nodes);
        }
      }
    }

    const uidQuads = this.input.getQuads(constraintNode, ODRL.terms.uid, null, null);
    if (uidQuads.length > 1 || (uidQuads.length === 1 &&!uidQuads[0].object.equals(constraintNode))) {
      throw new BadRequestHttpError(
        `Constraints can only have a single odrl:uid triple that needs to match the constraint node`);
    }
    result.quads.push(...uidQuads);

    // Everything else below is for standard constraints
    if (logicalOperator) {
      return result;
    }

    for (const predicate of [ ODRL.terms.leftOperand, ODRL.terms.operator ]) {
      const match = this.input.getQuads(constraintNode, predicate, null, null);
      if (match.length !== 1) {
        throw new BadRequestHttpError(`Constraint ${constraintNode.value} needs 1 ${predicate.value}`);
      }
      result.quads.push(...match);
    }
    for (const predicate of [ ODRL.terms.unit, ODRL.terms.status ]) {
      const match = this.input.getQuads(constraintNode, predicate, null, null);
      if (match.length > 1) {
        throw new BadRequestHttpError(`Constraint ${constraintNode.value} can have at most 1 ${predicate.value}`);
      }
      result.quads.push(...match);
    }
    const rightOperands = this.input.getQuads(constraintNode, ODRL.terms.rightOperand, null, null);
    const rightOperandReferences = this.input.getQuads(constraintNode, ODRL.terms.rightOperandReference, null, null);
    if (rightOperands.length + rightOperandReferences.length !== 1) {
      throw new BadRequestHttpError(`Constraint ${
        constraintNode.value} needs 1 right operand or right operand reference`);
    }
    result.quads.push(...rightOperands);
    result.quads.push(...rightOperandReferences);

    return result;
  }

  protected filterPolicyMetadata(policyNode: Term): Quad[] {
    const result: Quad[] = [];
    for (const predicate of [ DC.terms.creator, DC.terms.description, DC.terms.coverage ]) {
      result.push(...this.input.getQuads(policyNode, predicate, null, null));
    }

    // TODO: should verify that replaces only targets policies also created by this person (and that they exist)
    for (const predicate of [ DC.terms.issued, DC.terms.modified, DC.terms.replaces, DC.terms.isReplacedBy ]) {
      const matches = this.input.getQuads(policyNode, predicate, null, null);
      if (matches.length > 1) {
        throw new BadRequestHttpError(`Only 1 value is allowed for ${predicate.value}`);
      }
    }
    return result;
  }
}
