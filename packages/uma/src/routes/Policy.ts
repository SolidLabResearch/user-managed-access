import { BadRequestHttpError, getLoggerFor, MethodNotAllowedHttpError } from "@solid/community-server";
import { UCRulesStorage } from "@solidlab/ucp";
import { HttpHandlerContext, HttpHandlerResponse, HttpHandler, HttpHandlerRequest } from "../util/http/models/HttpHandler";
import { getPolicies } from "../util/routeSpecific/policies/GetPolicies";
import { addPolicies } from "../util/routeSpecific/policies/CreatePolicies";
import { deletePolicy } from "../util/routeSpecific/policies/DeletePolicies";
import { editPolicy } from "../util/routeSpecific/policies/EditPolicies";
import { rewritePolicy } from "../util/routeSpecific/policies/rewritePolicies";

/**
 * Endpoint to handle policies, this implementation gives all policies that have the
 * client as assigner.
 */
export class PolicyRequestHandler extends HttpHandler {

    protected readonly logger = getLoggerFor(this);

    constructor(
        protected readonly storage: UCRulesStorage,
        protected readonly baseUrl: string,
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
        if (typeof header !== 'string' && request.method !== "OPTIONS") {
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
            case 'GET': return getPolicies(request, store, client, this.baseUrl);
            case 'POST': return addPolicies(request, store, this.storage, client);
            case 'DELETE': return deletePolicy(request, store, this.storage, client, this.baseUrl);
            case 'PATCH': return editPolicy(request, store, this.storage, client, this.baseUrl);
            case 'PUT': return rewritePolicy(request, store, this.storage, client, this.baseUrl);
            case 'OPTIONS': return {
                status: 204,
                headers: {
                    // this is only for the url without <encodedId>
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
                }
            }
            default: throw new MethodNotAllowedHttpError();
        }
    }
}
