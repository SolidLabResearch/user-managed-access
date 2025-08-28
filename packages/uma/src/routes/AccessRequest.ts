import { BadRequestHttpError, getLoggerFor, MethodNotAllowedHttpError } from "@solid/community-server";
import { HttpHandler , HttpHandlerContext, HttpHandlerRequest, HttpHandlerResponse} from "../util/http/models/HttpHandler";
import { AccessRequestController } from "../util/routeSpecific/requests/controller/AccessRequestController";
import { MemoryAccessRequestStorage } from "../util/routeSpecific/requests/storage/MemoryAccessRequestStorage";

/**
 * Endpoint to handle access requests
 */
export class AccessRequestHandler extends HttpHandler {

    protected readonly logger = getLoggerFor(this);
    protected readonly controller = new AccessRequestController(
        new MemoryAccessRequestStorage()
    );

    constructor() {
        super();
    }

    /**
     * This function takes the GET-request with `Authorization: webID` and extracts the webID
     * (To be altered with actual Solid-OIDC)
     * 
     * TODO: extract this from this file as well as from the [PublicRequestHandler](./Policy.ts).
     * 
     * @param request the request with the client 'id' as body
     * @returns the client webID
     */
    protected getCredentials(request: HttpHandlerRequest): string {
        const header = request.headers['authorization'];
        if (typeof header !== 'string' && request.method !== "OPTIONS") {
            throw new BadRequestHttpError('Missing Authorization header');
        }
        return header;
    }

    public async handle({ request }: HttpHandlerContext) : Promise<HttpHandlerResponse<any>> {
        this.logger.info(`Received access request-grants request`);

        const client = this.getCredentials(request);

        switch (request.method) {
            case 'GET': return this.getAccessRequests(client);
            case 'POST': return this.addAccessRequest(request.body);
            case 'PATCH': return this.updateAccessRequest(request.body);
            case 'DELETE': return this.deleteAccessRequest(request.body);
            default: throw new MethodNotAllowedHttpError();
        }
    }

    private async getAccessRequests(client: string): Promise<HttpHandlerResponse<string>> {
        const result = await this.controller.getAccessRequests(client);
        return {
            body: result,
            headers: {},
            status: 200,
        };
    }

    private async addAccessRequest(data: string | unknown): Promise<HttpHandlerResponse<void>> {
        if (typeof data === "string") this.controller.addAccessRequest(data);
        return {
            body: undefined,
            headers: {},
            status: 200
        };
    }

    // ! At this point, there is no query validation to check whether an updateQuery doesn't delete, and vice versa.
    // ! This could be a potential security risk if not accounted for

    private async updateAccessRequest(query: string | unknown): Promise<HttpHandlerResponse<void>> {
        if (typeof query === "string") this.controller.updateAccessRequest(query);
        return {
            body: undefined,
            headers: {},
            status: 200
        };
    }

    private async deleteAccessRequest(query: string | unknown): Promise<HttpHandlerResponse<void>> {
        if (typeof query === "string") this.controller.deleteAccessRequest(query);
        return {
            body: undefined,
            headers: {},
            status: 200
        };
    }

}
