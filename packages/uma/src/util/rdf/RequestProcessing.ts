import {
  convertStringOrJsonLdIdentifierToString,
  ODRLPermission,
  StringOrJsonLdIdentifier
} from '../../views/Contract';
import { Permission } from '../../views/Permission';

export function switchODRLandCSSPermission(permission: string): string {
    if(permission.startsWith("urn:example:css:modes:")) {
        return permission.replace("urn:example:css:modes:", "https://w3id.org/oac#");
    } else if(permission.startsWith("https://w3id.org/oac#")) {
        return permission.replace("https://w3id.org/oac#", "urn:example:css:modes:");
    } else {
        throw new Error(`Permission ${permission} not recognized`)
    }
}

export function processRequestPermission(permission: ODRLPermission): Permission {
    // We do not accept AssetCollections as targets of an UMA access request formatted as an ODRL request!
    const resource_id = convertStringOrJsonLdIdentifierToString(permission.target as StringOrJsonLdIdentifier)
    const action: any = convertStringOrJsonLdIdentifierToString(permission.action)
    const resource_scopes = [ switchODRLandCSSPermission(action) ]

    return { resource_id, resource_scopes }
}
