import { BadRequestHttpError, getLoggerFor, MethodNotAllowedHttpError } from "@solid/community-server";
import { HttpHandler , HttpHandlerContext, HttpHandlerRequest, HttpHandlerResponse} from "../util/http/models/HttpHandler";
import { AccessRequestController } from "../util/routeSpecific/requests/controller/AccessRequestController";
import { AccessRequestStorage } from "../util/routeSpecific/requests/storage/AccessRequestStorage";

/**
 * Endpoint to handle access requests
 * TODO: check how CORS handling should be done
 */
export class AccessRequestHandler extends HttpHandler {

    protected readonly logger = getLoggerFor(this);
    protected readonly controller;

    constructor(
        storage: AccessRequestStorage,
        protected readonly baseUrl: string
    ) {
        super();
        this.controller = new AccessRequestController(storage);
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

    public async handle(context: HttpHandlerContext) : Promise<HttpHandlerResponse<any>> {
        this.logger.info(`Received access request-grants request`);
        try {
            if (context.request.method === 'OPTIONS')
                return this.handleOptionsRequest();
            return await this.routeRequest(context);
        } catch (error: any) {
            return {
                status: error.status ?? 500,
                body: error.message ?? 'Internal Server Error',
                headers: {
                    'access-control-allow-origin': '*',
                    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
                    'access-control-allow-headers': 'Content-Type, Authorization',
                }
            }
        }
    }

    private async routeRequest({ request }: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
        const client = this.getCredentials(request);

        switch (request.method) {
            case 'GET': return await this.getAccessRequests(client);
            case 'POST': return await this.addAccessRequest(request.body);
            case 'PATCH': return await this.updateAccessRequest(request.body, request.url);
            default: throw new MethodNotAllowedHttpError();
        }
    }

    private async handleOptionsRequest(): Promise<HttpHandlerResponse<void>> {
        return {
            status: 204,
            headers: {
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
                'access-control-allow-headers': 'Content-Type, Authorization',
            }
        }
    }

    private async getAccessRequests(client: string): Promise<HttpHandlerResponse<string>> {
        const result = await this.controller.getAccessRequests(client);
        return {
            body: result,
            headers: { 'access-control-allow-origin': '*' },
            status: 200, // succesfull answer
        };
    }

    private async addAccessRequest(data: string | unknown): Promise<HttpHandlerResponse<any>> {
        if (data) await this.controller.addAccessRequest(data.toString());
        return {
            headers: { 'access-control-allow-origin': '*' },
            status: 201 // Sucessfull creation
        };
    }

    private async updateAccessRequest(query: string | unknown, requestURL: URL): Promise<HttpHandlerResponse<any>> {
        const emptyQuery = !query;
        const correctBaseUrl = requestURL.toString().slice(0, this.baseUrl.length) === this.baseUrl

        if (emptyQuery || !correctBaseUrl) throw new MethodNotAllowedHttpError();

        const accessRequestId = decodeURIComponent(requestURL.toString().slice(this.baseUrl.length + "/requests/".length)); // this is ugly
        await this.controller.updateAccessRequest(query!.toString(), accessRequestId);
        return {
            headers: { 'access-control-allow-origin': '*' },
            status: 204
        }
    }

}
