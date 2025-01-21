import { ClaimSet } from "../../credentials/ClaimSet";
import { RequestODRLPermission, Permission } from "../../views/Permission";

export const PermissionMapping: any = {
    "https://w3id.org/oac#read": "urn:example:css:modes:read",
    "https://w3id.org/oac#write": "urn:example:css:modes:write",
    "https://w3id.org/oac#append": "urn:example:css:modes:append",
    "https://w3id.org/oac#delete": "urn:example:css:modes:delete",
}
export const ReversePermissionMapping: any = {
    "urn:example:css:modes:read": "https://w3id.org/oac#read",
    "urn:example:css:modes:write": "https://w3id.org/oac#write",
    "urn:example:css:modes:append": "https://w3id.org/oac#append",
    "urn:example:css:modes:delete": "https://w3id.org/oac#delete",
}

export function processRequestPermission(permission: RequestODRLPermission): Permission {

    const resource_id = permission.target
    const action: any = permission.action["@id"]
    const resource_scopes = [ PermissionMapping[action] ]

    return { resource_id, resource_scopes }
}


// const smartWatchAccessRequestODRL = {
//     permission: {
//       "@type": "Permission",
//       "@id": `http://example.org/HCPX-request-permission/${randomUUID()}`,
//       target: terms.resources.smartwatch,
//       action: { "@id": "https://w3id.org/oac#read" },
//       constraint: [
//         {
//           "@type": "Constraint",
//           "@id": `http://example.org/HCPX-request-permission-purpose/${randomUUID()}`,
//           leftOperand: "purpose",
//           operator: "eq",
//           rightOperand: { "@id": "http://example.org/bariatric-care" },
//         }, {
//           "@type": "Constraint",
//           "@id": `http://example.org/HCPX-request-permission-purpose/${randomUUID()}`,
//           leftOperand: { "@id": "https://w3id.org/oac#LegalBasis" },
//           operator: "eq",
//           rightOperand: {"@id": "https://w3id.org/dpv/legal/eu/gdpr#A9-2-a" },
//         }
//       ],
//     },
//     permissions: [{
//       resource_id: terms.resources.smartwatch,
//       resource_scopes: [ terms.scopes.read ],
//     }],
//   }

export function extractRequestClaims(permission: RequestODRLPermission): ClaimSet {

    return {}
}