import { UconRequest } from "../../src/Request"
import { UCPPolicy } from "../../src/policy/UsageControlPolicy"

export const owner = "https://pod.woutslabbinck.com/profile/card#me"
export const resource = "http://localhost:3000/test.ttl"
export const requestingParty = "https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me"

// acl actions
export const aclRead = "http://www.w3.org/ns/auth/acl#Read"
export const aclWrite = "http://www.w3.org/ns/auth/acl#Write"

// odrl actions
export const odrlRead = "http://www.w3.org/ns/odrl/2/read"
export const odrlWrite = "http://www.w3.org/ns/odrl/2/modify"
export const odrlUse = "http://www.w3.org/ns/odrl/2/use"

// requests
export const readPolicyRequest: UconRequest = {
    subject: requestingParty, action: [aclRead], resource: resource, owner: owner
}
export const writePolicyRequest: UconRequest = {
    subject: requestingParty, action: [aclWrite], resource: resource, owner: owner
}
export const usePolicyRequest: UconRequest = {
    subject: requestingParty, action: [aclWrite, aclRead], resource: resource, owner: owner
}

// policies 
export const readPolicy: UCPPolicy = { rules: [{ action: odrlRead, owner, resource, requestingParty }] }
export const writePolicy: UCPPolicy = { rules: [{ action: odrlWrite, owner, resource, requestingParty }] }
export const temporalReadPolicyOutOfBound: UCPPolicy = {
    rules: [{
        action: odrlRead, owner, resource, requestingParty,
        constraints: [
            { operator: "http://www.w3.org/ns/odrl/2/gt", type: "temporal", value: new Date("2024-01-01") }, // from: must be greater than given date
            { operator: "http://www.w3.org/ns/odrl/2/lt", type: "temporal", value: new Date("2024-01-02") }, // to: must be smaller than given date
        ]
    }]
}
export const temporalReadPolicyWithinBound: UCPPolicy = {
    rules: [{
        action: odrlRead, owner, resource, requestingParty,
        constraints: [
            { operator: "http://www.w3.org/ns/odrl/2/gt", type: "temporal", value: new Date(0) }, // from: must be greater than given date
            { operator: "http://www.w3.org/ns/odrl/2/lt", type: "temporal", value: new Date(new Date().valueOf() + 30_000) }, // to: must be smaller than given date
        ]
    }]
}
export const temporalWritePolicyOutOfBound: UCPPolicy = {
    rules: [{
        action: odrlWrite, owner, resource, requestingParty,
        constraints: [
            { operator: "http://www.w3.org/ns/odrl/2/gt", type: "temporal", value: new Date("2024-01-01") }, // from: must be greater than given date
            { operator: "http://www.w3.org/ns/odrl/2/lt", type: "temporal", value: new Date("2024-01-02") }, // to: must be smaller than given date
        ]
    }]
}
export const temporalWritePolicyWithinBound: UCPPolicy = {
    rules: [{
        action: odrlWrite, owner, resource, requestingParty,
        constraints: [
            { operator: "http://www.w3.org/ns/odrl/2/gt", type: "temporal", value: new Date(0) }, // from: must be greater than given date
            { operator: "http://www.w3.org/ns/odrl/2/lt", type: "temporal", value: new Date(new Date().valueOf() + 30_000) }, // to: must be smaller than given date
        ]
    }]
}
export const usePolicy: UCPPolicy = { rules: [{ action: odrlUse, owner, resource, requestingParty }] }