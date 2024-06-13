import { Store } from 'n3'
import { Permission } from '../..';
import { resourceLimits } from 'worker_threads';
import { Contract } from '../../views/Contract';


export class ContractStorage {

    private storage: Contract[] = []
    
    storeContract(contract: Contract) {
        this.storage.push(contract)
    }

    matchContract(permissions: Permission, assignee: string ) : Contract | undefined {
        // permissions.resource_id -> contract.target
        // permissions.resource_scopes -> contract.access.action
        // identifier -> contract.assignee
        
        return this.storage.find((contract: Contract) => {
            if (permissions.resource_id !== contract.target) return false;
            if (assignee !== contract.assignee) return false;
            // todo: test on scopes
            return true
        })
    }
}