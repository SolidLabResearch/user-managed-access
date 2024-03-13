/**
 * create ODRL policy with three constraints -> basically a function that prints that as output
        - constraints
            - start time
            - end time
            - purpose: string -> "age-verification"
        - target: SHACL shape?
 */

import { SimplePolicy, UCPPolicy, basicPolicy, storeToString } from '@solidlab/ucp'

export const agePurpose = "age-verification"
/**
 * Create demo ODRL policy:
 *
 * Read access for requestingparty to target under constraints (temporal + purpose)
 * @param targetIRI - an IRI representing the target -> the resource
 * @param requestingPartyIRI - an IRI representing the entity requesting access
 * @param constraints
 */
export function demoPolicy(targetIRI, requestingPartyIRI, constraints?: { startDate?: Date, endDate?: Date, purpose?: string }): SimplePolicy {
    const startDate = constraints?.startDate ?? new Date()
    const endDate = constraints?.endDate ?? new Date(startDate.valueOf()+ 86_400 * 14 * 1000)
    const purpose = constraints?.purpose ?? agePurpose

    const policy: UCPPolicy = {
        rules: [{
            requestingParty: requestingPartyIRI,
            action: "http://www.w3.org/ns/odrl/2/read", // msut be odrl
            resource: targetIRI,
            owner: "https://pod.woutslabbinck.com/profile/card#me", // can lead to bugs, depending on whether we use owner or not
            constraints: [
                {
                    type: "temporal",
                    operator: "http://www.w3.org/ns/odrl/2/gt",
                    value: startDate
                },
                {
                    type: "temporal",
                    operator: "http://www.w3.org/ns/odrl/2/lt",
                    value: endDate
                },
                {
                    type: "purpose",
                    operator: "http://www.w3.org/ns/odrl/2/eq",
                    value: purpose
                },
            ]
        }]
    }

    const policyObject = basicPolicy(policy);
    // console.log(storeToString(policyObject.representation));
    return policyObject
}

// example: Wout gives access to Ruben regarding Wout his age
// demoPolicy("urn:wout:age", "https://pod.rubendedecker.be/profile/card#me")