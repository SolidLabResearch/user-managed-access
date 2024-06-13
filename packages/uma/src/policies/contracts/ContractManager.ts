import { getLoggerFor } from "@solid/community-server";
import { DialogInput, Permission, Ticket } from "../.."
import { ContractStorage } from "./ContractStorage";
import { Contract, ODRLConstraint, ODRLPermission } from "../../views/Contract";
import { randomUUID } from "crypto";


export class ContractManager {
    private readonly logger = getLoggerFor(this)

    storage: ContractStorage = new ContractStorage();

    findContract(input: Ticket) : Contract | undefined {
        let identifier = input.provided["urn:solidlab:uma:claims:types:webid"] as string | undefined
        if (!identifier) return;
        if (input.permissions.length !== 1) {
            this.logger.debug("Cannot process multiple permission requests with current policy instantiation setup")
            return
        }
        // todo:: handle multiple permission requirements in the same request

        // todo:: check contract requirements are still valid
        return this.storage.matchContract(input.permissions[0], identifier)
    }

    createContract(perms: Permission[]): Contract {

        const target = perms[0].resource_id

        // todo: fix purpose and dates
        const startDate = new Date().toISOString()
        const endDate = nextweek().toISOString()
        const purpose = 'urn:solidlab:uma:claims:purpose:age-verification'
        const assigner = 'http://localhost:3000/ruben/profile/card#me'
        const assignee = 'http://localhost:5123/id'

        let constraints: ODRLConstraint[] = [
            {
                leftOperand: 'dateTime',
                operator: 'gt',
                rightOperand: startDate
            }, {
                leftOperand: 'dateTime',
                operator: 'lt',
                rightOperand: endDate
            }, {
                leftOperand: 'purpose',
                operator: 'eq',
                rightOperand: purpose
            }
        ]

        let accessPermission: ODRLPermission = {
            action: 'read',
            constraint: constraints

        }
        let usagePermission: ODRLPermission = {
            action: 'use',
            constraint: constraints
        }

        // todo:: fix instantiated from
        // todo:: un-mock?
        
        let contract: Contract = {
            "@context": [
                "http://www.w3.org/ns/odrl.jsonld", {
                    "prov": "http://www.w3.org/ns/prov#"
                }
            ],
            "@type": "Agreement",
            target: target,
            uid: `urn:solidlab:uma:contract:${randomUUID()}`,
            assigner: assigner,
            assignee: assignee,
            permission: [accessPermission, usagePermission]
        }

        this.storage.storeContract(contract)

        return contract;
    }

}

function nextweek(): Date{
    var today = new Date();
    var nextweek = new Date(today.getFullYear(), today.getMonth(), today.getDate()+7);
    return nextweek;
}