import { randomUUID } from "crypto";


export type  ODRLConstraint = {
    leftOperand: any,
    operator: any,
    rightOperand: any,
}

export type ODRLPermission = {
    action: string[],
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

export type Permission = {
    resource_id: string,
    resource_scopes: string[],
};


export type AccessToken = {
    permissions: Permission[],
    contractId?: string,
}

export type Retrieval = {
    timestamp: Date, 
    resourceId: ResourceId,
    data: Data,
}


export default class BackendStore {
    // Map<id, Contract>
    private contracts = new Array<Contract>();
    private retrievals = new Array<Retrieval>();
    // Maps retrieval Id on Contract Id
    private mapping = new Map<string, string>();


    storeContract(contract: Contract) {
        this.contracts.push(contract);
    }

    storeRetrieval(retrieval: Retrieval) {
        this.retrievals.push(retrieval)

        let relevantContract = this.contracts.find(contract => contract.target === retrieval.resourceId)
        if(relevantContract) this.mapping.set(retrieval.resourceId, relevantContract.uid)
    }

    getLogs() {
        let results: {retrieval: Retrieval, contract: Contract}[] = []
        for (let retrieval of this.retrievals) {
            results.push({
                retrieval,
                contract: this.contracts.filter(c => c.uid === this.mapping.get(retrieval.resourceId as string))[0]
            })
        }
        return results
    }
}


