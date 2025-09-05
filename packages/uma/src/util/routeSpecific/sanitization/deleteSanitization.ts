import { Store } from "n3"
import { queryEngine } from ".";

const sanitizeDelete = async (
    store: Store,
    query: string,
): Promise<void> => {
    await queryEngine.queryVoid(query, { sources: [ store ] });
}

const deletePolicyQuery = (policyID: string, clientID: string) => `
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

    DELETE {
        ?policy ?policyPredicate ?policyObject .
        ?permission ?permissionPredicate ?permissionObject .
    } WHERE {
        ?policy a odrl:Agreement ;
                odrl:permission ?permission ;
                odrl:uid <${policyID}> .
        ?permission odrl:assigner <${clientID}> .

        ?policy ?policyPredicate ?policyObject .
        ?permission ?permissionPredicate ?permissionObject .
    }
`;

export const sanitizeDeletePolicy = (store: Store, policyID: string, clientID: string) =>
    sanitizeDelete(store, deletePolicyQuery(policyID, clientID));

const deleteRequestQuery = (requestID: string, clientID: string) => `
    PREFIX sotw: <https://w3id.org/force/sotw#>
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

    DELETE {
        ?req ?p ?o
    } WHERE {
        ?req odrl:uid <${requestID}> ;
             ?p ?o .
        {
            ?req sotw:requestingParty <${clientID}> .
        } 
        UNION
        {
            ?req sotw:requestedTarget ?target .
            ?pol a odrl:Agreement ;
                 odrl:permission ?per .
            ?per odrl:target ?target ;
                 odrl:assigner <${clientID}> .
        }
    }
`;

export const sanitizeDeleteRequest = (store: Store, requestID: string, clientID: string) =>
    sanitizeDelete(store, deleteRequestQuery(requestID, clientID));
