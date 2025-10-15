import { randomUUID } from 'crypto';
import { getLoggerFor } from 'global-logger-factory';
import { Permission, Ticket } from '../..'
import { switchODRLandCSSPermission } from '../../util/rdf/RequestProcessing';
import { ODRLContract, ODRLPermission } from '../../views/Contract';
import { ContractStorage } from './ContractStorage';

export class ContractManager {
    private readonly logger = getLoggerFor(this)

    storage: ContractStorage = new ContractStorage();

    findContract(input: Ticket) : ODRLContract | undefined {
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

    createContract(perms: Permission[]): ODRLContract {
        // todo: un-mock this!!!
        type Pair = { action: string, target: string };
        const permissionPairs: Pair[] = perms.flatMap(
          (perm): Pair[] => perm.resource_scopes.map(
            (scope): Pair => ({ action: scope, target: perm.resource_id })));

        const contract: ODRLContract = {
            "@context": "http://www.w3.org/ns/odrl.jsonld",
            "@type": "Agreement",
            uid: `urn:uma:pacsoi:agreement:${randomUUID()}`,
            "http://purl.org/dc/terms/description": "Agreement for HCP X to read Alice's health data for bariatric care.",
            "https://w3id.org/dpv#hasLegalBasis": { "@id": "https://w3id.org/dpv/legal/eu/gdpr#eu-gdpr:A9-2-a" },
            permission: permissionPairs.map(({ action, target }): ODRLPermission => ({
                "@type": "Permission",
                action: switchODRLandCSSPermission(action),
                target: target,
                assigner: 'http://localhost:3000/ruben/profile/card#me', // user WebID
                assignee: 'http://localhost:3000/alice/profile/card#me', // target WebID
                constraint: [ {
                    "@type": "Constraint",
                    leftOperand: "purpose",
                    operator:  "eq",
                    rightOperand: { "@id": "http://example.org/bariatric-care" },
                } ]
            })),
        }
        return contract;
    }

}

function nextweek(): Date{
    var today = new Date();
    var nextweek = new Date(today.getFullYear(), today.getMonth(), today.getDate()+7);
    return nextweek;
}
