import { Type, array, string, optional, any } from "../util/ReType";

export const ODRLConstraint = {
    "@type": optional(string),
    uid: optional(string),
    leftOperand: string,
    operator: string,
    rightOperand: string,
}

export const ODRLPermission = {
    "@type": optional(string),
    uid: optional(string),
    action: string,
    target: string, // resourceURL
    assigner: string, // user WebID
    assignee: string, // target WebID
    constraint: array(ODRLConstraint)
}

export const Contract = {
    "@context": optional(string),
    "@type": string,
    uid: string, // instantiated policy UID
    permission: array(ODRLPermission),
    "prov:wasDerivedFrom": optional(array(string)),
};

export type ODRLConstraint = Type<typeof ODRLConstraint>;
export type ODRLPermission = Type<typeof ODRLPermission>;
export type Contract = Type<typeof Contract>;
