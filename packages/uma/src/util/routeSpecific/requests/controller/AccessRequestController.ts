import type { AccessRequestStorage } from "../storage/AccessRequestStorage";
import { Parser, Writer, Store } from "n3";

export class AccessRequestController {
    public constructor(
        private readonly store: AccessRequestStorage
    ) {

    }

    private parseTurtle(data: string): void {
        const parser = new Parser();
        parser.parse(data, {
            onQuad: (_, quad) => { if (quad) this.store.getStore().addQuad(quad); }
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
        this.parseTurtle(data);
    }

    public async getAccessRequests(requestingPartyId: string): Promise<string> {
        const store = await this.store.getAccessRequest(requestingPartyId);
        return this.writeToTurtle(store);
    }

    // ! There is no query validation to check the validity of the queries received right now
    // ! This is a potential security risk if not accounted for

    public async updateAccessRequest(query: string): Promise<void> {
        await this.store.updateAccessRequest(query);
    }

    public async deleteAccessRequest(requestingPartyId: string, requestedTarget: string): Promise<void> {
        await this.store.deleteAccessRequest(requestingPartyId, requestedTarget);
    }
}
