import { Type, array, optional, string, union,  } from "../util/ReType";

export const Permission = {
    resource_id: string,
    resource_scopes: array(string),
};

export type Permission = Type<typeof Permission>;


export const JsonLdIdentifier = {
    '@id': string
}

export type JsonLdIdentifier = Type<typeof JsonLdIdentifier>;


export const RequestODRLConstraint = {
    '@type': optional('Constraint'),
    '@id': optional(string),
    'leftOperand': union(string, JsonLdIdentifier),
    'operator': union(string, JsonLdIdentifier),
    'rightOperand': union(string, JsonLdIdentifier)
}

export type RequestODRLConstraint = Type<typeof RequestODRLConstraint>;


export const RequestODRLPermission = {
    '@type': optional('Permission'),
    '@id': optional(string),
    target: string,
    action: JsonLdIdentifier,
    constraint: optional(array(RequestODRLConstraint))
}

export type RequestODRLPermission = Type<typeof RequestODRLPermission>;

//         "@type": "Constraint",
//         "@id": `http://example.org/HCPX-request-permission-purpose/${randomUUID()}`,
//         leftOperand: "purpose",
//         operator: "eq",
//         rightOperand: { "@id": "http://example.org/bariatric-care" },
//       },