import { ConflictHttpError } from '@solid/community-server';
import { UCRulesStorage } from "../ucp/storage/UCRulesStorage";
import { getLoggerFor } from 'global-logger-factory';
import { Parser, Store } from 'n3';
import { writeStore } from "../util/ConvertUtil";
import { HttpHandlerResponse } from '../util/http/models/HttpHandler';
import { noAlreadyDefinedSubjects } from "../util/routeSpecific/sanitizeUtil";

/**
 * Controller class for Policy & Access Request endpoints.
 * Handles the logic for manipulating policies or access requests.
 */
export abstract class BaseController {

    protected readonly logger = getLoggerFor(this);

    constructor(
        protected readonly store: UCRulesStorage,
        protected sanitizePost: (store: Store, clientID: string) => Promise<{ result: Store, id: string }>,
        protected sanitizeDelete: (store: Store, entityID: string, clientID: string) => Promise<void>,
        protected sanitizeGets: (store: Store, clientID: string) => Promise<Store>,
        protected sanitizeGet: (store: Store, entityID: string, clientID: string) => Promise<Store>,
        protected sanitizePatch: (store: Store, entityID: string, clientID: string, patchInformation: string) => Promise<void>
    ) { }

    /**
     * Execute a given sanitizeGet-like function and serialize its results as Turtle.
     *
     * @param sanitizeGet function to execute retrieval and sanitization
     * @returns results serialized in Turtle and status code 200,
     *          or an empty body with status 404 if nothing was found
     */
    private async get(sanitizeGet: () => Promise<Store>): Promise<{ message: string, status: number }> {
        const store = await sanitizeGet();

        const message = store.size > 0 ? await writeStore(store) : '';
        const status = 200;
        return { message, status };
    }

    /**
     * Retrieve all policies (including rules) or all access requests belonging to a given `clientID`.
     *
     * @param clientID ID of the requesting party (RP)
     * @returns a Turtle-serialized store of all policies or access requests,
     *          and an HTTP status code indicating success (200) or not found (404)
     */
    public async getEntities(clientID: string): Promise<{ message: string, status: number }> {
        return await this.get(async () => this.sanitizeGets(await this.store.getStore(), clientID));
    }

    /**
     * Retrieve a single policy (including its rules) or access request identified by `entityID` for a given `clientID`.
     *
     * @param entityID ID pointing to the policy or access request
     * @param clientID ID pointing to the requesting party (RP)
     * @returns a Turtle-serialized representation of the policy/access request and HTTP status code (200),
     *          or an empty body with status 404 if not found
     */
    public async getEntity(entityID: string, clientID: string): Promise<{ message: string, status: number}> {
        return await this.get(async () => this.sanitizeGet(await this.store.getStore(), entityID, clientID));
    }

    /**
     * Add a new policy (with at least one rule) or access request on behalf of a given `clientID`.
     * Ensures no duplicate subjects already exist in the store.
     *
     * @param data RDF data in Turtle/N3 format representing the new policy or access request
     * @param clientID ID of the requesting party (RP) creating the entity
     * @returns a status code:
     *          - 201 if creation was successful
     *          - 409 if a conflict occurred (duplicate subject)
     */
    public async addEntity(data: string, clientID: string):
        Promise<{ status: number, message?: string, id: string }> {
        const store = new Store(new Parser().parse(data));

        const { result, id } = await this.sanitizePost(store, clientID);
        if (noAlreadyDefinedSubjects(await this.store.getStore(), result))
            this.store.addRule(result);
        else throw new ConflictHttpError();

        return { status: 201, id  }; // success
    }

    /**
     * Delete a single policy (including rules) or access request identified by `entityID` for a given `clientID`.
     *
     * @param entityID ID pointing to the policy or access request
     * @param clientID ID of the requesting party (RP) making the deletion
     * @returns a status code:
     *          - 204 if deletion was successful
     */
    public async deleteEntity(entityID: string, clientID: string): Promise<{ status: number }> {
        const filteredStore = new Store(await this.store.getStore());
        await this.sanitizeDelete(filteredStore, entityID, clientID);
        const diff = (await this.store.getStore()).difference(filteredStore);
        await this.store.removeData(diff as Store);
        return { status: 204 }; // no content
    }

    /**
     * Apply a patch to a single policy or access request identified by `entityID`.
     *
     * If `isolate` is true, all information related to the entity is first isolated to prevent unintended side effects.
     * After patching, the entity is sanitized and reinserted.
     *
     * @param entityID ID pointing to the policy or access request
     * @param patchInformation information describing the patch to be applied (query or JSON, but content type of request must match this.contentType)
     * @param clientID ID of the requesting party (RP) making the patch
     * @param isolate whether to isolate the entity's quads during patching (defaults to true)
     * @returns a status code:
     *          - 204 if patching was successful
     */
    public async patchEntity(entityID: string, patchInformation: string, clientID: string, isolate: boolean = true): Promise<HttpHandlerResponse<string>> {
        let response: HttpHandlerResponse<string> = { status: 204, body: '' };
        let filteredStore = new Store(await this.store.getStore());
        let omitStore: Store;

        if (isolate) { // requires isolating all information about the entity provided, as e.g. the patchinformation has a query to be executed
            filteredStore = await this.sanitizeGet(filteredStore, entityID, clientID);
            omitStore = new Store(await this.store.getStore());
            omitStore.removeQuads([ ...filteredStore]);
        }

        await this.sanitizePatch(filteredStore, entityID, clientID, patchInformation);

        if (isolate) {
            // isolate all information about the store again, because queries could insert information
            // * bonus: filters out extra quads
            // ! drawback: PATCH may still be used to DELETE all information about the entity
            // TODO: check if PATCH is smth we want for all resources, make patchEntity optional otherwise
            filteredStore = await this.sanitizeGet(filteredStore, entityID, clientID) || filteredStore;
            omitStore!.addAll(filteredStore);
            filteredStore = omitStore!;
        }

        const originalStore = await this.store.getStore();
        const remove = originalStore.difference(filteredStore);
        const add = filteredStore.difference(originalStore);

        if (remove.size > 0) {
            await this.store.removeData(remove as Store);
        }
        if (add.size > 0) {
            await this.store.addRule(add as Store);
        }

        return response;
    }

    /**
     * Apply a PUT to a single policy or access request identified by `entityID`.
     *
     * Currently, this is only implemented for policies.
     *
     * @param data RDF data in Turtle/N3 format representing a policy or access request
     * @param entityID ID pointing to the policy or access request
     * @param clientID ID pointing to requesting party making the put
     * @returns a status code:
     *          - 204 if put was successful
     */
    public async putEntity(data: string, entityID: string, clientID: string): Promise<{ status: number }> {
        // check if this entity is already defined in the store
        const getResult = await this.getEntity(entityID, clientID);
        if (getResult.status !== 200) return { status: 404 };

        // parse the entity through a POST request and check the results
        const store = new Store(new Parser().parse(data));
        const { result } = await this.sanitizePost(store, clientID);

        // delete the old rule and insert the new
        await this.deleteEntity(entityID, clientID);
        await this.store.addRule(result);
        return { status: 204 };
    }
}
