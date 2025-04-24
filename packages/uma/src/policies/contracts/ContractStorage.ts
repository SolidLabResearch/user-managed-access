import { Store } from 'n3'
import { Permission } from '../..';
import { resourceLimits } from 'worker_threads';
import { ODRLContract } from '../../views/Contract';


export class ContractStorage {

    private storage: ODRLContract[] = []
    
    storeContract(contract: ODRLContract) {
        this.storage.push(contract)
    }

    matchContract(permissions: Permission, assignee: string ) : ODRLContract | undefined {
        // permissions.resource_id -> contract.target
        // permissions.resource_scopes -> contract.access.action
        // identifier -> contract.assignee
        
        return this.storage.find((contract: ODRLContract) => {
            if (permissions.resource_id !== contract.permission[0].target) return false;
            if (assignee !== contract.permission[0].assignee) return false;
            // todo: test on scopes
            return true
        })
    }
}