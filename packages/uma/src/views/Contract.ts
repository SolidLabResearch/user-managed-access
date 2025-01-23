import { Type, array, string, optional, any, union } from "../util/ReType";

export const JsonLdIdentifier = {
    '@id': string
}

export const StringOrJsonLdIdentifier = union(string, JsonLdIdentifier)

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
    target: StringOrJsonLdIdentifier, // resourceURL
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


export function convertStringOrJsonLdIdentifierToString(x : StringOrJsonLdIdentifier) : string {
    const id = (x as JsonLdIdentifier)["@id"]
    return id ? id : x as string
}