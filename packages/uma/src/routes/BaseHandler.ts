import { BadRequestHttpError, getLoggerFor, MethodNotAllowedHttpError } from "@solid/community-server";
import { BaseController } from "../controller/BaseController";
import { HttpHandler, HttpHandlerContext, HttpHandlerRequest, HttpHandlerResponse } from "../util/http/models/HttpHandler";
import { getAuthorizationHeader } from "../util/routeSpecific/middlewareUtil";

/**
 * Base handler for policy and access request endpoints
 * TODO: check name
 */
export abstract class BaseHandler extends HttpHandler {

    protected readonly logger = getLoggerFor(this);
    
    constructor(
        protected readonly controller: BaseController,
        private readonly handleLogMessage: string,
        private readonly patchContentType: string,
    ) {
        super();
    }

    public async handle({ request }: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
        this.logger.info(this.handleLogMessage);

        if (request.method === 'OPTIONS')
            return this.handleOptions();

        const client = getAuthorizationHeader(request);

        if (request.parameters?.id) {
            switch (request.method) {
                case 'GET': return this.handleSingleGet(request.parameters.id, client);
                case 'PATCH': return this.handlePatch(request as HttpHandlerRequest<string>, request.parameters.id, client);
                case 'DELETE': return this.handleDelete(request.parameters.id, client);
                default: throw new BadRequestHttpError();
            }
        } else {
            switch (request.method) {
                case 'GET': return this.handleGet(client);
                case 'POST': return this.handlePost(request as HttpHandlerRequest<string>, client);
                default: throw new BadRequestHttpError();
            }
        }
    }

    /**
     * Append CORS headers to response
     * TODO: Check CORS handling with Joachim
     * @param response response containing a body, status and headers
     * @returns the same response with CORS headers appended
     */
    private addCORSHeaders(response: HttpHandlerResponse<any>): HttpHandlerResponse<any> {
        const { status, body, headers } = response;
        return {
            status: status,
            body: body,
            headers: {
                ...headers,
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                'access-control-allow-headers': 'authorization, content-type'
            }
        }
    }

    /**
     * Handle simple OPTIONS request to any of the specified endpoints on this handler
     * @param request OPTIONS request to be handled
     * @returns a simple 204 with CORS headers
     */
    private async handleOptions(): Promise<HttpHandlerResponse<any>> {
        const result = { status: 204 };
        return this.addCORSHeaders(result);
    }

    private async handleSingleGet(entityID: string, clientID: string): Promise<HttpHandlerResponse<string>> {
        const { message, status } = await this.controller.getEntity(entityID, clientID);
        return this.addCORSHeaders({
            status: status,
            body: message
        });
    }

    private async handlePatch(request: HttpHandlerRequest<string>, entityID: string, clientID: string): Promise<HttpHandlerResponse<void>> {
        let status = 500;

        if (!request.body) throw new BadRequestHttpError();
        if (this.patchContentType === 'application/json') {
            const body = JSON.parse(request.body);
            if (body.status) status = (await this.controller.patchEntity(entityID, body.status, clientID, false)).status;
            else throw new BadRequestHttpError();
        } else status = (await this.controller.patchEntity(entityID, request.body, clientID)).status;

        return this.addCORSHeaders({
            status: status
        });
    }

    private async handleDelete(entityID: string, clientID: string): Promise<HttpHandlerResponse<void>> {
        const { status } = await this.controller.deleteEntity(entityID, clientID);
        return this.addCORSHeaders({
            status: status
        });
    }

    private async handleGet(clientID: string): Promise<HttpHandlerResponse<string>> {
        const { status, message } = await this.controller.getEntities(clientID);
        return this.addCORSHeaders({
            status: status,
            body: message,
        });
    }

    private async handlePost(request: HttpHandlerRequest<string>, clientID: string): Promise<HttpHandlerResponse<void>> {
        if (!request.body) throw new BadRequestHttpError();
        const { status } = await this.controller.addEntity(request.body.toString(), clientID);
        return this.addCORSHeaders({
            status: status
        });
    }
}
