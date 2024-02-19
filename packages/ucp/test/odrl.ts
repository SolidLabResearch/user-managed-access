import { storeToString } from "../src/util/Conversion"
import { UCPPolicy } from "../src/policy/UsageControlPolicy"
import { basicPolicy } from "../src/policy/ODRL"

const odrlRead = "http://www.w3.org/ns/odrl/2/read"

const owner = "https://pod.woutslabbinck.com/profile/card#me"
const resource = "http://localhost:3000/test.ttl"
const requestingParty = "https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me"
const temporalReadPolicyOutOfBound: UCPPolicy = {
    rules: [
        {
            action: odrlRead, owner, resource, requestingParty,
            constraints: [
                { operator: "http://www.w3.org/ns/odrl/2/gt", type: "temporal", value: new Date("2024-01-01") }, // from: must be greater than given date
                { operator: "http://www.w3.org/ns/odrl/2/lt", type: "temporal", value: new Date("2024-01-02") }, // to: must be smaller than given date
            ]
        }
    ]
}

console.log(storeToString(basicPolicy(temporalReadPolicyOutOfBound).representation))