import { SimplePolicy, UCPPolicy, basicPolicy } from '@solidlab/ucp'

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
