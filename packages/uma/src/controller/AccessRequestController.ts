import {
    BadRequestHttpError,
    createErrorMessage,
    KeyValueStorage,
    NotFoundHttpError
} from "@solid/community-server";
import { UCRulesStorage } from "../ucp/storage/UCRulesStorage";
import { Ticket } from "../ticketing/Ticket";
import { BaseController } from "./BaseController";
import {
    createAccessRequestsFromTicket,
    deleteAccessRequest,
    getAccessRequest,
    getAccessRequests,
    patchAccessRequest,
    postAccessRequest
} from "../util/routeSpecific";

/**
 * Controller for routes concerning access requests
 */
export class AccessRequestController extends BaseController {
    constructor(
        store: UCRulesStorage,
        protected readonly ticketStore?: KeyValueStorage<string, Ticket>,
    ) {
        super(
            store,
            'Already existing requests found',
            postAccessRequest,
            deleteAccessRequest,
            getAccessRequests,
            getAccessRequest,
            patchAccessRequest,
        );
    }

    public async addEntity(data: string, clientID: string): Promise<{ status: number, message: string }> {
        const trimmed = data.trim();
        if (!trimmed.startsWith('{')) {
            return super.addEntity(data, clientID);
        }

        try {
            if (!this.ticketStore) {
                throw new BadRequestHttpError('Access requests from tickets are not configured.');
            }

            const input = JSON.parse(trimmed) as { ticket?: unknown };
            if (typeof input.ticket !== 'string' || input.ticket.length === 0) {
                throw new BadRequestHttpError('Expected JSON body with a non-empty `ticket` field.');
            }

            const ticket = await this.ticketStore.get(input.ticket);
            if (!ticket) {
                throw new NotFoundHttpError('Unknown ticket.');
            }

            const requests = createAccessRequestsFromTicket(ticket, clientID);
            await this.store.addRule(requests);
            await this.ticketStore.delete(input.ticket);
            return { status: 202, message: '' };
        } catch (e) {
            const status = e instanceof SyntaxError ?
                400 :
                typeof e === 'object' && e && 'statusCode' in e ? e.statusCode as number : 500;
            return {
                status,
                message: createErrorMessage(e),
            };
        }
    }

    /**
     * Deletes are not allowed on access requests.
     *
     * @param entityID ID pointing to the policy or access request
     * @param clientID ID of the resource owner (RO) or requesting party (RP) making the deletion
     * @returns a status code: 403
     */
    public async deleteEntity(entityID: string, clientID: string): Promise<{ status: number }> {
        return { status: 403 };
    }

    public async putEntity(data: string, entityID: string, clientID: string): Promise<{ status: number }> {
        return { status: 403 };
    }

}
