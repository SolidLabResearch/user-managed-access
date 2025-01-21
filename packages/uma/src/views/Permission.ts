import { Type, array, string } from "../util/ReType";

export const Permission = {
    resource_id: string,
    resource_scopes: array(string),
};

export type Permission = Type<typeof Permission>;


export const ODRLAction = {
    '@id': string
}

export type ODRLAction = Type<typeof ODRLAction>;


export const ODRLConstraint = {
    '@id': string
}

export type ODRLConstraint = Type<typeof ODRLConstraint>;


export const ODRLPermission = {
    '@type': 'Permission',
    '@id': string,
    target: string,
    action: ODRLAction,
}

export type ODRLPermission = Type<typeof ODRLPermission>;

