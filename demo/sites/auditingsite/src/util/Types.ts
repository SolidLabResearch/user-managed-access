
export type  ODRLConstraint = {
    left: any,
    op: any,
    right: any,
    // leftOperand: any,
    // operator: any,
    // rightOperand: any,
}

export type ODRLPermission = {
    action: string | string[],
    constraint: ODRLConstraint[]
}

export type Contract = {
    "@context": string,
    "@type": string,
    target: string, // resourceURL
    uid: string, // instantiated policy UID
    assigner: string, // user WebID
    assignee: string, // target WebID
    permission: ODRLPermission[],
};


export type Data = string
export type ResourceId = string

export type AuditEntry = {
    contract: Contract,
    token: string,
    webId: string // todo:: this should not be required
    data: Data,
    timestamp: Date, 
    resourceId: ResourceId,
}
