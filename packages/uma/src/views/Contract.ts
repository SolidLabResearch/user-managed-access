import { ODRL } from '../ucp/util/Vocabularies';
import { Type, array, string, optional, any, union } from "../util/ReType";

export const JsonLdIdentifier = {
    '@id': string
}

export const StringOrJsonLdIdentifier = union(string, JsonLdIdentifier)
export const IdentifierSet = union(StringOrJsonLdIdentifier, array(StringOrJsonLdIdentifier))
export const ODRLAssetCollection = {
    "@type": string,
    "source": string,
}
export const ODRLTargetOrAssetCollection = union(StringOrJsonLdIdentifier, ODRLAssetCollection)


export const ODRLConstraint = {
    "@type": optional(string),
    "@id": optional(string),
    uid: optional(string),
    leftOperand: StringOrJsonLdIdentifier,
    operator: StringOrJsonLdIdentifier,
    rightOperand: StringOrJsonLdIdentifier,
}

export const ODRLPermission = {
    "@type": optional(string),
    "@id": optional(string),
    uid: optional(string),
    action: StringOrJsonLdIdentifier,
    target: ODRLTargetOrAssetCollection, // resourceURL
    assigner: StringOrJsonLdIdentifier, // user WebID
    assignee: StringOrJsonLdIdentifier, // target WebID
    constraint: optional(array(ODRLConstraint))
}

export const ODRLContract = {
    "@context": optional(string),
    "@type": optional(string),
    uid: string, // instantiated policy UID
    permission: array(ODRLPermission),
    "https://w3id.org/dpv#hasLegalBasis": optional(StringOrJsonLdIdentifier),
    "http://purl.org/dc/terms/description": optional(string),
    "http://www.w3.org/ns/prov#wasDerivedFrom": optional(array(string)),
};

export type ODRLConstraint = Type<typeof ODRLConstraint>;
export type ODRLPermission = Type<typeof ODRLPermission>;
export type ODRLContract = Type<typeof ODRLContract>;
export type JsonLdIdentifier = Type<typeof JsonLdIdentifier>;
export type StringOrJsonLdIdentifier = Type<typeof StringOrJsonLdIdentifier>;
export type IdentifierSet = Type<typeof IdentifierSet>;
export type ODRLAssetCollection = Type<typeof ODRLAssetCollection>;
export type ODRLTargetOrAssetCollection = Type<typeof ODRLTargetOrAssetCollection>;


export function convertStringOrJsonLdIdentifierToString(x : StringOrJsonLdIdentifier) : string {
    const id = (x as JsonLdIdentifier)["@id"]
    return id ? id : x as string
}

/**
 * Note: This check makes the assumption of slash-semantics based resource ordering!
 * @param url
 * @param policyTarget
 * @returns
 */
export function isPolicyTarget(url: string, policyTarget: ODRLTargetOrAssetCollection) {
    // AssetCollection
    const assetCollectionType  = (policyTarget as ODRLAssetCollection)["@type"]
    if (assetCollectionType && assetCollectionType === ODRL.namespace + "AssetCollection") {
        return url.startsWith((policyTarget as ODRLAssetCollection).source)
    }

    // @id identfier
    const id = (policyTarget as JsonLdIdentifier)["@id"]
    if (id && url === id) return true

    // string
    return (policyTarget as string) === url

}

export function getPolicyTargets(policyTarget: ODRLTargetOrAssetCollection): string {
    // AssetCollection
    const assetCollectionType  = (policyTarget as ODRLAssetCollection)["@type"]
    if (assetCollectionType && assetCollectionType === ODRL.namespace + "AssetCollection") {
        return (policyTarget as ODRLAssetCollection).source
    }

    // @id identfier
    const id = (policyTarget as JsonLdIdentifier)["@id"]
    if (id) return id

    // string
    return policyTarget as string
}
