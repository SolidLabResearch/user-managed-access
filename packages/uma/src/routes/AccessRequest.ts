import { BadRequestHttpError, getLoggerFor, MethodNotAllowedHttpError } from "@solid/community-server";
import { HttpHandler , HttpHandlerContext, HttpHandlerRequest, HttpHandlerResponse} from "../util/http/models/HttpHandler";
import { createAccessRequests } from "../util/routeSpecific/requests/CreateAccessRequests";
import { getAccessRequests } from "../util/routeSpecific/requests/GetAccessRequests";
import { updateAccessRequests } from "../util/routeSpecific/requests/UpdateAccessRequests";

/**
 * Endpoint to handle access requests
 */
export class AccessRequestHandler extends HttpHandler {

    protected readonly logger = getLoggerFor(this);

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
            case 'GET': return getAccessRequests(request, client);
            case 'POST': return createAccessRequests(request, client);
            case 'PATCH': return updateAccessRequests(request, client);
            default: throw new MethodNotAllowedHttpError();
        }
    }

}
