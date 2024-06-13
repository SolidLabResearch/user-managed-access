import { Contract } from "./storage";

var firstDay = new Date();
var nextWeek = new Date(firstDay.getTime() + 7 * 24 * 60 * 60 * 1000);

const contract: Contract = {
    "@context": "http://www.w3.org/ns/odrl.jsonld",
    "@type": "Agreement",
    "uid": "urn:ucp:policy:120312314134",
    "assigner": "http://localhost:3000/ruben/profile/card#me",
    "assignee": "http://localhost:3000/store/#me",
    "target": "http://localhost:3000/ruben/private/derived/age",
    "permission": [{
        action: ["read", "use"],
        constraint: [{
            "leftOperand": "dateTime",
            "operator": "gt",
            "rightOperand": { "@value": new Date().toISOString(), "@type": "xsd:date" }
        }, {
            "leftOperand": "dateTime",
            "operator": "lt",
            "rightOperand": { "@value": nextWeek.toISOString(), "@type": "xsd:date" }
        }, {
            "leftOperand": "purpose",
            "operator": "eq",
            "rightOperand": { "@id": "urn:udp:policy:constraints:age-verification" }
        }]
    }]
}
console.log(JSON.stringify(contract, null, 2))