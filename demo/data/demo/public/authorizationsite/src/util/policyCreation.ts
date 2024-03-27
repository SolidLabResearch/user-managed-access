import { DataFactory, Quad, Store } from "n3";
import { v4 as uuidv4 } from 'uuid';
import { ODRL, RDF, XSD } from "./Vocabularies";
const { quad, namedNode, literal } = DataFactory


/**
 * Interface for a Simple Usage Control Policy
 */
export interface SimplePolicy {
  // representation of the ucon rule + policy (which could be an offer or agreement)
  representation: Store;
  // identifier of the policy
  policyIRI: string;
  // identifier of the rule
  ruleIRIs: string[];
}

/**
 * Interface for a Usage Control Policy
 */
export interface UCPPolicy {
  type?: string, // default Agreement
  rules: UCPRule[]
}

/**
 * Interface for a Usage Control Rule.
 */
export interface UCPRule {
  type?:string, // default Permission
  action: string,
  resource: string,
  requestingParty: string,
  owner?: string,
  constraints?: UCPConstraint[]
}

/**
* Interface for a Usage Control Policy Constraint
*/
export interface UCPConstraint {
  type: string,
  operator: string,
  value: any
}



/**
 * Create a simple ODRL policy with an agreement and one rule
 * @param policy 
 * @param policyIRI 
 * @returns 
 */
export function basicPolicy(policy: UCPPolicy, policyIRI?: string): SimplePolicy {
  policyIRI = policyIRI ?? "urn:ucp:policy:" + uuidv4();
  const store = new Store();
  const ruleIRIs: string[] = []
  if (policy.type) {
    store.addQuad(namedNode(policyIRI), RDF.terms.type, namedNode(policy.type))
  } else {
    store.addQuad(namedNode(policyIRI), RDF.terms.type, ODRL.terms.Agreement)
  }
  for (const rule of policy.rules) {
    const {
      quads,
      ruleIRI
    } = createRuleQuads(rule, policyIRI)
    store.addQuads(quads)
    ruleIRIs.push(ruleIRI)
  }

  return { representation: store, policyIRI: policyIRI, ruleIRIs: ruleIRIs }
}

/**
 * Convert an Usage Control Rule to ODRL quads
 * @param rule 
 * @param policyIRI 
 * @returns 
 */
export function createRuleQuads(rule: UCPRule, policyIRI?: string): { quads: Quad[], ruleIRI: string } {
  const quads: Quad[] = []
  const ruleIRI = "urn:ucp:rule:" + uuidv4();
  quads.push(quad(namedNode(ruleIRI), ODRL.terms.action, namedNode(rule.action)))
  quads.push(quad(namedNode(ruleIRI), ODRL.terms.target, namedNode(rule.resource)))
  quads.push(quad(namedNode(ruleIRI), ODRL.terms.assignee, namedNode(rule.requestingParty)))
  if (rule.owner) {
    quads.push(quad(namedNode(ruleIRI), ODRL.terms.assigner, namedNode(rule.owner)))
  }
  if (rule.type !== undefined) {
    quads.push(quad(namedNode(ruleIRI), RDF.terms.type, namedNode(rule.type)))
  } else {
    quads.push(quad(namedNode(ruleIRI), RDF.terms.type, ODRL.terms.Permission))
    if (policyIRI) {
      // note: currently, only this case is handled to add the policy
      quads.push(quad(namedNode(policyIRI), ODRL.terms.permission, namedNode(ruleIRI)))
    }
  }
  for (const constraint of rule.constraints ?? []) {
    const { quads: constraintQuads } = createConstraintQuads(constraint, ruleIRI)
    quads.push(...constraintQuads)
  }
  return {
    quads,
    ruleIRI
  }
}

/**
 * Convert an Usage Control Constraint to ODRL quads
 * @param rule 
 * @param policyIRI 
 * @returns 
 */
export function createConstraintQuads(
  constraint: UCPConstraint, 
  ruleIRI?: string
): { quads: Quad[], constraintIRI: string } {
  const quads: Quad[] = []
  const constraintIRI = "urn:ucp:constraint:" + uuidv4();
  switch (constraint.type) {
    case "temporal": // maybe have as type something more semantically defined?
      quads.push(quad(namedNode(constraintIRI), ODRL.terms.leftOperand, ODRL.terms.dateTime));
      quads.push(quad(namedNode(constraintIRI), ODRL.terms.operator, namedNode(constraint.operator)));
      quads.push(quad(namedNode(constraintIRI), ODRL.terms.rightOperand, 
        literal((constraint.value as Date).toISOString(), XSD.terms.dateTime)));
      if (ruleIRI) {
        quads.push(quad(namedNode(ruleIRI), ODRL.terms.constraint, namedNode(constraintIRI)))
      }
      break;
    case "purpose":
      quads.push(quad(namedNode(constraintIRI), ODRL.terms.leftOperand, ODRL.terms.purpose));
      quads.push(quad(namedNode(constraintIRI), ODRL.terms.operator, namedNode(constraint.operator)));
      quads.push(quad(namedNode(constraintIRI), ODRL.terms.rightOperand, literal(constraint.value)));
      if (ruleIRI) {
        quads.push(quad(namedNode(ruleIRI), ODRL.terms.constraint, namedNode(constraintIRI)))
      }
      break;
    default:
      console.log("Can not create constraint as the type is not understood:", constraint.type);
      break;
  }
  return {
    quads,
    constraintIRI
  }
}






/**
 * Create demo ODRL policy:
 *
 * Read access for requestingparty to target under constraints (temporal + purpose)
 * @param targetIRI - an IRI representing the target -> the resource
 * @param requestingPartyIRI - an IRI representing the entity requesting access
 * @param constraints - the temporal and purpuse constraints on the usage of the data
 */
export function demoPolicy(
  targetIRI: string, 
  requestingPartyIRI: string, 
  constraints?: { 
    startDate?: Date, 
    endDate?: Date, 
    purpose?: string 
  }
): SimplePolicy {
  const constraintList: any[] = [];

  if (constraints?.startDate) constraintList.push({
    type: 'temporal',
    operator: 'http://www.w3.org/ns/odrl/2/gt',
    value: constraints?.startDate,
  });

  if (constraints?.endDate) constraintList.push({
    type: 'temporal',
    operator: 'http://www.w3.org/ns/odrl/2/lt',
    value: constraints?.endDate,
  });

  if (constraints?.purpose) constraintList.push({
    type: 'purpose',
    operator: 'http://www.w3.org/ns/odrl/2/eq',
    value: constraints?.purpose,
  });

  const policy: UCPPolicy = {
    rules: [{
      resource: targetIRI,
      action: "http://www.w3.org/ns/odrl/2/read", // ODRL action
      requestingParty: requestingPartyIRI,
      // owner: "https://pod.woutslabbinck.com/profile/card#me", // might error
      constraints: constraintList
    }]
  }

  const policyObject = basicPolicy(policy);

  return policyObject
}
