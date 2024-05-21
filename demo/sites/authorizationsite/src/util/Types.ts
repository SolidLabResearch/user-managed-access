import { Store } from "n3";



export interface VerifiableCredential{
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://w3id.org/security/data-integrity/v2"
    ],
    "id": string,
    "location": string,
    "type": string[],
    "issuer": string,
    "issuanceDate": Date,
    "credentialSubject": Object,
    "dc:description": string,
    "proof": {
      "type": string,
      "created": Date,
      "verificationMethod": string,
      "cryptosuite": string,
      "proofPurpose": string,
      "proofValue": string
    }
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

  policyLocation?: string;
  policyText?: string;
  description?: string;
  isSystemPolicy?: boolean;
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
 * Interface for a Simple Usage Control Policy
 */
export interface InstantiatedPolicy {
  // representation of the ucon rule + policy (which could be an offer or agreement)
  representation: Store;
  // identifier of the policy
  policyIRI: string;
  // identifier of the rule
  ruleIRIs: string[];

  policyLocation?: string;
  policyText?: string;
  description?: string;
  "prov:wasDerivedFrom"?: string[];
}
