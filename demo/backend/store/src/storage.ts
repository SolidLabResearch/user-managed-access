
export type  ODRLConstraint = {
    leftOperand: any,
    operator: any,
    rightOperand: any,
}

export type ODRLPermission = {
    action: string[],
    constraint: ODRLConstraint[]
}

export type Embedded = {
    contract: Contract,
    token: string,
    webId: string // todo:: this should not be required
    data: Data,
    timestamp: Date, 
    resourceId: ResourceId,
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

export type Permission = {
    resource_id: string,
    resource_scopes: string[],
};

export type AccessToken = {
    permissions: Permission[],
    contractId?: string,
}

export default class BackendStore {
    
    private retrievals = new Array<Embedded>();


    storeEmbedded(embedded: Embedded) {
        this.retrievals.push(embedded)
    }

    getLogs() {
        return this.retrievals
    }
}


