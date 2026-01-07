import { Store } from "n3"

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

