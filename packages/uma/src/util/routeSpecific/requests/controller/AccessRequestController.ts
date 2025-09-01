import { getLoggerFor } from "@solid/community-server";
import type { AccessRequestStorage } from "../storage/AccessRequestStorage";
import { Parser, Writer, Store } from "n3";
import { QueryEngine } from "@comunica/query-sparql";

export class AccessRequestController {
    
    private readonly logger = getLoggerFor(this);
    
    public constructor(
        private readonly store: AccessRequestStorage
    ) {

    }

    private async parseTurtle(data: string, store: Store): Promise<void> {
        const parser = new Parser();

        parser.parse(data, {
            onQuad: (_, quad) => { if (quad) store.addQuad(quad); }
        });
    }

    private writeToTurtle(store: Store): string {
        const writer = new Writer();
        let result: string = '';

        writer.addQuads(store.getQuads(null, null, null, null));
        writer.end((_, quad) => result = quad);

        return result;
    }

    public async addAccessRequest(data: string): Promise<void> {
        // create a new store to store the request
        const store = new Store();
        await this.parseTurtle(data, store);

        // find the subject that signifies the id of the request
        const subjects = store.getSubjects("http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "https://w3id.org/force/sotw#EvaluationRequest", null);
        if (subjects.length === 0 || subjects.length > 1) throw { status: 400, message: 'Bad request definition' };
        const subject = subjects[0];

        // check if subject is already in store and add if not
        if (this.store.getStore().countQuads(subject, null, null, null) > 0) throw { status: 409, message: 'Request is already defined' };
        else await this.store.addAccessRequest(store);
    }

    public async getAccessRequests(requestingPartyId: string): Promise<string> {
        const store = await this.store.getAccessRequest(requestingPartyId);
        return this.writeToTurtle(store);
    }

    public async updateAccessRequest(query: string, accessRequestId: string): Promise<void> {
        // create a new store which holds all quads concerning the access request
        const quads = this.store.getStore().getQuads(accessRequestId, null, null, null);
        const store = new Store(quads);
        this.store.getStore().removeQuads(quads); // remove them from the old store

        // find the quad that holds the request status
        const statusQuads = store.getQuads(accessRequestId, "https://example.org/requestStatus", null, null);
        if (statusQuads.length !== 1) throw { status: 400, message: statusQuads.length.toString() } // shouldn't happen

        const statusStore = new Store(statusQuads);
        store.removeQuads(statusQuads); // remove the old status quad from intermediate result
        
        // retrieve ID
        const idQuads = store.getQuads(accessRequestId, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "https://w3id.org/force/sotw#EvaluationRequest", null);
        if (idQuads.length !== 1) throw  { status: 400, message: `idQuads.length = ${idQuads.length}` } // shouldn't happen

        // add id quads to status store
        // this store now has two quads:
        //  - id
        //  - status
        // the latter should be the only one changed by the query, we can make sure of this by checking it
        statusStore.addQuads(idQuads);
        
        await new QueryEngine().queryVoid(query, { sources: [ statusStore ] });

        const newStatus = statusStore.getObjects(accessRequestId, "https://example.org/requestStatus", null);
        if (newStatus.length !== 1) throw { status: 400, message: newStatus.length.toString() }
        if (newStatus[0].value.toString() !== "https://example.org/accepted" && newStatus[0].value.toString() !== "https://example.org/denied")
            throw { status: 400, message: newStatus[0].value.toString() }

        // rebuild the store
        statusStore.removeQuads(idQuads);
        store.addQuads(statusStore.getQuads(null, null, null, null));
        this.store.getStore().addQuads(store.getQuads(null, null, null, null));
    }
}
