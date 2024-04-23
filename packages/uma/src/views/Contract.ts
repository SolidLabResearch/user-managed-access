import { Type, array, string, optional } from "../util/ReType";


export const ODRLConstraint = {
    left: string,
    op: string,
    right: string,
}

export const ODRLPermission = {
    action: string,
    constraint: array(ODRLConstraint)
}

export const Contract = {
    instantiatedFrom: optional(array(string)),
    "@context": string,
    "@type": string,
    target: string, // resourceURL
    uid: string, // instantiated policy UID
    assigner: string, // user WebID
    assignee: string, // target WebID
    permission: array(ODRLPermission),
};








export type ODRLConstraint = Type<typeof ODRLConstraint>;
export type ODRLPermission = Type<typeof ODRLPermission>;
export type Contract = Type<typeof Contract>;
