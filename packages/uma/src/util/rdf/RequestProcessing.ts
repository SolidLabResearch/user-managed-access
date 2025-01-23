import { ClaimSet } from "../../credentials/ClaimSet";
import { convertStringOrJsonLdIdentifierToString, ODRLPermission } from "../../views/Contract";
import { Permission } from "../../views/Permission";

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

export function processRequestPermission(permission: ODRLPermission): Permission {

    const resource_id = convertStringOrJsonLdIdentifierToString(permission.target)
    const action: any = convertStringOrJsonLdIdentifierToString(permission.action)
    const resource_scopes = [ PermissionMapping[action] ]

    return { resource_id, resource_scopes }
}

export function extractRequestClaims(permission: ODRLPermission): ClaimSet {

    return {}
}