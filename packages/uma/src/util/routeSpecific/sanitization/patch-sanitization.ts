import { Store } from "n3";
import { queryEngine } from ".";

export const sanitizePatchPolicy = async (
    store: Store,
    entityID: string,
    clientID: string,
    query: string
) =>  {
    // check ownership of resource -- is client assigner?
    const isOwner = store.countQuads(null, "http://www.w3.org/ns/odrl/2/assigner", clientID, null) === 1;
    if (!isOwner) return ; // ? shouldn't this throw an error -- drawback would be information leakage
    else await queryEngine.queryVoid(query, { sources: [store] });
}

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

export const sanitizePatchRequest = async (
    store: Store,
    entityID: string,
    clientID: string,
    patchInformation: string
) => {
    if (!['accepted', 'denied'].includes(patchInformation)) return ; // ? perhaps throw an error?
    const query = patchRequestQuery(entityID, clientID, patchInformation);
    await queryEngine.queryVoid(query, { sources: [store] });
}
