import { UCRulesStorage } from "@solidlab/ucp";
import { Store } from "n3";
import { writeStore } from "../util/ConvertUtil";
import { parseStringAsN3Store } from 'koreografeye';
import { noAlreadyDefinedSubjects } from "../util/routeSpecific/sanitizeUtil";

/**
 * Controller class for Policy & Access Request endpoints
 */
export abstract class BaseController {
    constructor(
        protected readonly store: UCRulesStorage,
        protected readonly conflictMessage: string,
        protected readonly sanitizePost: (store: Store, clientID: string) => Promise<Store>,
        protected readonly sanitizeDelete: (store: Store, entityID: string, clientID: string) => Promise<void>,
        protected readonly sanitizeGets: (store: Store, clientID: string) => Promise<Store>,
        protected readonly sanitizeGet: (store: Store, entityID: string, clientID: string) => Promise<Store>,
        protected readonly sanitizePatch: (store: Store, entityID: string, clientID: string, patchInformation: string) => Promise<void>
    ) {

    }

    private async get(sanitizeGet: Function): Promise<{ message: string, status: number }> {
        const store = await sanitizeGet();
        const message = store.size > 0
            ? await writeStore(store)
            : '';

        const status = message === ''
            ? 404 : 200;

        return { message, status };
    }

    public async getEntities(clientID: string): Promise<{ message: string, status: number }> {
        return await this.get(async () => this.sanitizeGets(await this.store.getStore(), clientID));
    }

    public async getEntity(entityID: string, clientID: string): Promise<{ message: string, status: number}> {
        return await this.get(async () => this.sanitizeGet(await this.store.getStore(), entityID, clientID));
    }

    public async addEntity(data: string, clientID: string): Promise<{ status: number }> {
        const store = await parseStringAsN3Store(data);
        const sanitizedStore = await this.sanitizePost(store, clientID);

        if (noAlreadyDefinedSubjects(await this.store.getStore(), sanitizedStore))
            this.store.addRule(sanitizedStore);
        else return { status: 409 }; // conflict

        return { status: 201 }; // success
    }

    public async deleteEntity(entityID: string, clientID: string): Promise<{ status: number }> {
        await this.sanitizeDelete(await this.store.getStore(), entityID, clientID);
        return { status: 204 }; // no content
    }

    public async patchEntity(entityID: string, patchInformation: string, clientID: string, isolate: boolean = true): Promise<{ status: number }> {
        let store: Store;
        if (isolate) { // requires isolating all information about the entity provided, as e.g. the patchinformation has a query to be executed
            store = await this.sanitizeGet(await this.store.getStore(), entityID, clientID);
            (await this.store.getStore()).removeQuads(store.getQuads(null, null, null, null));
        } else store = await this.store.getStore();

        await this.sanitizePatch(store, entityID, clientID, patchInformation);

        if (isolate) {
            // isolate all information about the store again, because queries could insert information
            // * bonus: filters out extra quads
            // ! drawback: PATCH may still be used to DELETE all information about the entity
            // TODO: check if PATCH is smth we want for all resources, make patchEntity optional otherwise
            store = await this.sanitizeGet(store, entityID, clientID);
            (await this.store.getStore()).addAll(store);
        }

        return { status: 204 };
    }
}
