import { BadRequestHttpError, getLoggerFor, MethodNotAllowedHttpError } from "@solid/community-server";
import { UCRulesStorage } from "@solidlab/ucp";
import { HttpHandlerContext, HttpHandlerResponse, HttpHandler, HttpHandlerRequest } from "../util/http/models/HttpHandler";
import { getPolicies as getPolicies } from "../util/routeSpecific/policies/";
import { addPolicies } from "../util/routeSpecific/policies/CreatePolicies";

/**
 * Endpoint to handle policies, this implementation gives all policies that have the
 * client as assigner.
 */
export class PolicyRequestHandler extends HttpHandler {

    protected readonly logger = getLoggerFor(this);

    constructor(
        private readonly storage: UCRulesStorage
    ) {
        super();
    }

    /**
     * This function takes the GET-request with `Authorization: webID` and extracts the webID
     * (To be altered with actual Solid-OIDC)
     * 
     * @param request the request with the client 'id' as body
     * @returns the client webID
     */
    protected getCredentials(request: HttpHandlerRequest): string {
        const header = request.headers['authorization'];
        if (typeof header !== 'string') {
            throw new BadRequestHttpError('Missing Authorization header');
        }
        return header;
    }

    /**
     * Handle every /uma/policies request.
     */
    public async handle({ request }: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
        this.logger.info(`Received policy request`);

        // Extract client from request
        const client = this.getCredentials(request);
        const store = await this.storage.getStore();

        switch (request.method) {
            case 'GET': return getPolicies(request, store, client);
            case 'POST': return addPolicies(request, store, this.storage, client);
            // TODO: add other endpoints
            default: throw new MethodNotAllowedHttpError();
        }
    }
}
