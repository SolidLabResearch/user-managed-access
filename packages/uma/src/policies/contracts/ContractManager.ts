import { getLoggerFor } from "@solid/community-server";
import { DialogInput, Permission, Ticket } from "../.."
import { ContractStorage } from "./ContractStorage";
import { Contract, ODRLConstraint, ODRLPermission } from "../../views/Contract";
import { randomUUID } from "crypto";
import { ReversePermissionMapping } from "../../util/rdf/RequestProcessing";


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
        console.log('Creating Contract', JSON.stringify(perms, null, 2))

        // todo: un-mock this!!!
        const permission = perms[0];

        const contract: any = {
            "@context": "http://www.w3.org/ns/odrl.jsonld",
            "@type": "Agreement",
            uid: `urn:uma:pacsoi:agreement:${randomUUID()}`,
            "http://purl.org/dc/terms/description": "Agreement for HCP X to read Alice's health data for bariatric care.",
            "https://w3id.org/dpv#hasLegalBasis": { "@id": "https://w3id.org/dpv/legal/eu/gdpr#eu-gdpr:A9-2-a" },
            permission:  { 
                "@type": "Permission",
                action: ReversePermissionMapping[permission.resource_scopes[0]],
                target: permission.resource_id,
                assigner: 'http://localhost:3000/ruben/profile/card#me', // user WebID
                assignee: 'http://localhost:3000/alice/profile/card#me', // target WebID
                constraint: {
                    "@type": "Constraint",
                    leftOperand: "purpose",
                    operator:  "eq",
                    rightOperand: { "@id": "http://example.org/bariatric-care" },
                }
            }
        }

//         PREFIX dcterms: <http://purl.org/dc/terms/>
// PREFIX dpv: <https://w3id.org/dpv#>
// PREFIX eu-gdpr: <https://w3id.org/dpv/legal/eu/gdpr#>
// PREFIX odrl: <http://www.w3.org/ns/odrl/2/>
// PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

// <http://example.org/agreement-permission> a odrl:Permission ;
//     odrl:action odrl:read ;
//     odrl:target ex:health-data ;
//     odrl:assigner ex:alice ;
//     odrl:assignee ex:HCPx ;
//     odrl:constraint <http://example.org/agreement-permission-purpose> .

// <http://example.org/agreement-permission-purpose> a odrl:Constraint ;
//     odrl:leftOperand odrl:purpose ; 
//     odrl:operator odrl:eq ;
//     odrl:rightOperand ex:bariatric-care .




    
        // const target = perms[0].resource_id

        // // todo: fix purpose and dates
        // const startDate = new Date().toISOString()
        // const endDate = nextweek().toISOString()
        // const purpose = 'urn:solidlab:uma:claims:purpose:age-verification'
        // const assigner = 'http://localhost:3000/ruben/profile/card#me'
        // const assignee = 'http://localhost:5123/id'

        // let constraints: ODRLConstraint[] = [
        //     {
        //         leftOperand: 'dateTime',
        //         operator: 'gt',
        //         rightOperand: startDate
        //     }, {
        //         leftOperand: 'dateTime',
        //         operator: 'lt',
        //         rightOperand: endDate
        //     }, {
        //         leftOperand: 'purpose',
        //         operator: 'eq',
        //         rightOperand: purpose
        //     }
        // ]

        // let accessPermission: ODRLPermission = {
        //     action: 'read',
        //     constraint: constraints

        // }
        // let usagePermission: ODRLPermission = {
        //     action: 'use',
        //     constraint: constraints
        // }

        // // todo:: fix instantiated from
        // // todo:: un-mock?
        
        // let contract: Contract = {
        //     "@context": "http://www.w3.org/ns/odrl.jsonld",
        //     "@type": "Agreement",
        //     target: target,
        //     uid: `urn:solidlab:uma:contract:${randomUUID()}`,
        //     assigner: assigner,
        //     assignee: assignee,
        //     permission: [accessPermission, usagePermission]
        // }

        // this.storage.storeContract(contract)

        return contract as unknown as Contract;
    }

}

function nextweek(): Date{
    var today = new Date();
    var nextweek = new Date(today.getFullYear(), today.getMonth(), today.getDate()+7);
    return nextweek;
}