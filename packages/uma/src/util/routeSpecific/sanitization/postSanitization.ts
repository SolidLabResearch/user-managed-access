import { Store } from "n3";
import { queryEngine } from ".";
import { SanitizationError } from "../sanitizeUtil";

/**
 * Run a query against the store and extract exactly one matching subgraph.
 *
 * For each result binding, a sub-store is created containing all triples
 * where the bound terms appear as subjects. If multiple or no results are found,
 * the function rejects with a {@link SanitizationError}.
 *
 * @param store the source store to query
 * @param query the query string to execute
 * @param vars list of variables that must be present in the result
 * @returns a store containing exactly one matching subgraph
 * @throws {SanitizationError} if zero or more than one entity is found
 */
const sanitizePost = async (
    store: Store,
    query: string,
    vars: string[]
): Promise<Store> => {
    const bindings = await queryEngine.queryBindings(query, { sources: [store] });
    const results: Store[] = [];

    bindings.on('data', (binding) => {
        const subsStore = new Store();
        let valid = true;

        for (const v of vars) {
            const term = binding.get(v);

            if (!term) {
                valid = false;
                break;
            }

            subsStore.addQuads(store.getQuads(term, null, null, null));
        }

        if (valid) results.push(subsStore);
    });

    return new Promise<Store>((resolve, rejects) => {
        bindings.on('end', () => {
            if (results.length !== 1) rejects(new SanitizationError(`too many or too few entities defined`));
            else resolve(results[0]);
        });
    });
};

/**
 * Build a query to retrieve a newly posted policy,
 * ensuring that the client is the assigner of its permission.
 *
 * @param clientID identifier of the client
 * @returns a query string
 */
const postPolicyQuery = (clientID: string) => `
    PREFIX odrl: <http://www.w3.org/ns/odrl/2/>
    PREFIX dct: <http://purl.org/dc/terms/>

    SELECT ?p ?r
    WHERE {
        ?p a odrl:Agreement ;
           odrl:permission ?r ;
           odrl:uid ?p .

        ?r a odrl:Permission ;
           odrl:action ?action ;
           odrl:target ?target ;
           odrl:assignee ?assignee ;
           odrl:assigner <${clientID}> .
    }
`;

/**
 * Validate and retrieve a newly posted policy.
 *
 * Requires that the policy has exactly one matching definition
 * and that the client is the assigner of its permission.
 *
 * @param store the source store
 * @param clientID identifier of the client (assigner)
 * @returns the validated policy as a store
 * @throws {SanitizationError} if zero or more than one policy matches
 */
export const sanitizePostPolicy = (store: Store, clientID: string) =>
    sanitizePost(store, postPolicyQuery(clientID), ["p", "r"]);

/**
 * Build a query to retrieve a newly posted request,
 * ensuring it has correct status and is linked to the client
 * as the requesting party.
 *
 * @param clientID identifier of the client
 * @returns a query string
 */
const postRequestQuery = (clientID: string) => `
    PREFIX ex: <http://example.org/>
    PREFIX sotw: <https://w3id.org/force/sotw#>
    PREFIX dcterms: <http://purl.org/dc/terms/>

    SELECT ?r
    WHERE {
        ?r a sotw:EvaluationRequest ;
           dcterms:issued ?date ;
           sotw:requestedTarget ?target ;
           sotw:requestedAction ?action ;
           sotw:requestingParty <${clientID}> ;
           ex:requestStatus ex:requested .
    }
`;

/**
 * Validate and retrieve a newly posted request.
 *
 * Requires that the request has correct status (`requested`),
 * is issued, and is linked to the given client as requesting party.
 *
 * @param store the source store
 * @param clientID identifier of the client
 * @returns the validated request as a store
 * @throws {SanitizationError} if zero or more than one request matches
 */
export const sanitizePostRequest = (store: Store, clientID: string) =>
    sanitizePost(store, postRequestQuery(clientID), ["r"]);

/**
 * Check whether all subjects in the new store
 * are absent from the existing store.
 *
 * This is used to ensure no pre-existing entities
 * are being redefined.
 *
 * @param store the original store
 * @param newStore the store containing new data
 * @returns true if no subjects are already defined, false otherwise
 */
export const noAlreadyDefinedSubjects = (store: Store, newStore: Store): boolean =>
    newStore.getSubjects(null, null, null)
        .every((subject) => store.countQuads(subject, null, null, null) === 0);
