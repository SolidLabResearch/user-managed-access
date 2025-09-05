import { Store } from "n3";
import { queryEngine } from ".";

const sanitizeGet = async (
    store: Store,
    query: string,
    vars: string[]
): Promise<Store> => {
    const result = new Store();

    const bindings = await queryEngine.queryBindings(query, { sources: [store] });
    const results: Store[] = [];

    bindings.on('data', (binding) => {
        const subStore = new Store();
        let valid = true;

        for (const v of vars) {
            const term = binding.get(v);

            if (!term) {
                valid = false;
                break;
            }

            subStore.addQuads(store.getQuads(term, null, null, null));
        }

        if (valid) results.push(subStore)
    });

    return new Promise<Store>((resolve, _rejects) => {
        bindings.on('end', () => {
            results.forEach((resultStore) => result.addAll(resultStore));
            resolve(result);
        });
    });
}

const getPolicyQuery = (policyID: string, clientID: string) => `
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>
    
    SELECT DISTINCT ?policy ?perm
    WHERE {
        ?policy a odrl:Agreement ;
                odrl:uid <${policyID}> ;
                odrl:permission ?perm .
        {
            ?perm odrl:assigner <${clientID}> .
        }
        UNION
        {
            ?perm odrl:assignee <${clientID}> .
        }
    }
`;

export const sanitizeGetPolicy = (store: Store, policyID: string, clientID: string) =>
    sanitizeGet(store, getPolicyQuery(policyID, clientID), ['policy', 'perm']);

const getPoliciesQuery = (clientID: string) => `
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>
    
    SELECT DISTINCT ?policy ?perm
    WHERE {
        ?policy a odrl:Agreement ;
                odrl:permission ?perm .
        {
            ?perm odrl:assigner <${clientID}> .
        }
        UNION
        {
            ?perm odrl:assignee <${clientID}> .
        }
    }
`;

export const sanitizeGetPolicies = (store: Store, clientID: string) =>
    sanitizeGet(store, getPoliciesQuery(clientID), ['policy', 'perm']);

// ! There is not necessarily a link between resource owner and resource through a policy
// ! Currently, only the requests where the client is requesting party will be given,
// ! for requested targets that aren't included in some policy already.
const getRequestQuery = (requestID: string, clientID: string) => `
    PREFIX sotw: <https://w3id.org/force/sotw#>
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

    SELECT DISTINCT ?req
    WHERE {
        ?req odrl:uid <${requestID}> .
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

export const sanitizeGetRequest = (store: Store, requestID: string, clientID: string) =>
    sanitizeGet(store, getRequestQuery(requestID, clientID), ['req']);

const getRequestsQuery = (clientID: string) => `
    PREFIX sotw: <https://w3id.org/force/sotw#>
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

    SELECT DISTINCT ?req
    WHERE {
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

export const sanitizeGetRequests = (store: Store, clientID: string) =>
    sanitizeGet(store, getRequestsQuery(clientID), ['req']);
