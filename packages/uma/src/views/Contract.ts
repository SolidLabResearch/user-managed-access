import { Type, array, string, optional, any } from "../util/ReType";


export const ODRLConstraint = {
    leftOperand: string,
    operator: string,
    rightOperand: string,
}

export const ODRLPermission = {
    action: string,
    constraint: array(ODRLConstraint)
}

export const Contract = {
    "@context": any,
    "@type": string,
    target: string, // resourceURL
    uid: string, // instantiated policy UID
    assigner: string, // user WebID
    assignee: string, // target WebID
    permission: array(ODRLPermission),
    "prov:wasDerivedFrom": optional(array(string)),
};








export type ODRLConstraint = Type<typeof ODRLConstraint>;
export type ODRLPermission = Type<typeof ODRLPermission>;
export type Contract = Type<typeof Contract>;
