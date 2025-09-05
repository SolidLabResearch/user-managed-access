import { v4 as uuid } from 'uuid';
import { Store } from "n3";
import { queryEngine } from ".";
import { getLoggerFor } from '@solid/community-server';

export const sanitizePatchPolicy = async (
    store: Store,
    _entityID: string,
    clientID: string,
    query: string
) =>  {
    // check ownership of resource -- is client assigner?
    const isOwner = store.countQuads(null, "http://www.w3.org/ns/odrl/2/assigner", clientID, null) === 1;
    if (!isOwner) return ; // ? shouldn't this throw an error -- drawback would be information leakage
    else await queryEngine.queryVoid(query, { sources: [store] });
}

// ! link between target and resource owner is not always included through a policy
// ! there should be some endpoint or link in the store that allows for this discovery
// ! currently, this patch will not work!
const patchRequestQuery = (entityID: string, clientID: string, patchInformation: string) => `
    PREFIX ex: <http://example.org/> 
    PREFIX sotw: <https://w3id.org/force/sotw#>
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

    DELETE {
        ?req ex:requestStatus ex:requested .
    } INSERT {
        ?req ex:requestStatus ex:${patchInformation} .
    } WHERE {
        ?req a sotw:EvaluationRequest ;
             sotw:requestedTarget ?target ;
             odrl:uid <${entityID}> .
        ?pol a odrl:Agreement ;
             odrl:permission ?perm .
        ?perm odrl:target ?target ;
              odrl:assigner <${clientID}> .
    }
`;

// ! doesn't check if there is already an existing policy between these entities for the same resource
// TODO: include that check
const createPolicyFromRequestQuery = (
    entityID: string,
    policy: string,
    permission: string,
    assigner: string,
) => `
    PREFIX ex: <http://example.org/>
    PREFIX sotw: <https://w3id.org/force/sotw#>
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

    INSERT {
        ex:${policy} a odrl:Agreement ;
                    odrl:uid ex:${policy} ;
                    odrl:permission ex:${permission} .
        ex:${permission} a odrl:Permission ;
                        odrl:action ?action ;
                        odrl:target ?target ;
                        odrl:assignee ?requestingParty ;
                        odrl:assigner <${assigner}> .
    } WHERE {
        ?req a sotw:EvaluationRequest ;
             odrl:uid <${entityID}> ;
             sotw:requestingParty ?requestingParty ;
             sotw:requestedTarget ?target ;
             sotw:requestedAction ?action ;
             ex:requestStatus ex:accepted .
    }
`;

export const sanitizePatchRequest = async (
    store: Store,
    entityID: string,
    clientID: string,
    patchInformation: string
) => {
    if (!['accepted', 'denied'].includes(patchInformation)) return ; // ? perhaps throw an error?
    const patchQuery = patchRequestQuery(entityID, clientID, patchInformation);
    await queryEngine.queryVoid(patchQuery, { sources: [store] });

    if (patchInformation === 'accepted') {
        const newPolicyQuery = createPolicyFromRequestQuery(entityID, uuid(), uuid(), clientID);
        await queryEngine.queryVoid(newPolicyQuery, { sources: [store] });
    }
}
