import { BadRequestHttpError, getLoggerFor, MethodNotAllowedHttpError } from "@solid/community-server";
import { BaseController } from "../controller/BaseController";
import { HttpHandler, HttpHandlerContext, HttpHandlerRequest, HttpHandlerResponse } from "../util/http/models/HttpHandler";
import { verifyHttpCredentials } from "../util/routeSpecific/middlewareUtil";

/**
 * Base handler for policy and access request endpoints.
 * 
 * Provides a generic request-handling layer between HTTP requests and the {@link BaseController}.
 * Handles routing based on HTTP method and request parameters, logging, and validation.
 * 
 * Supported methods:
 *  - **GET** `/:id`    -  retrieve a single policy (including its rules) or access request 
 *  - **PATCH** `/:id`  -  patch a policy (and rules) or access request
 *  - **PUT** `/:id`    - rewrite a policy (and rules) or access request
 *  - **DELETE** `/:id` -  delete policy or access request
 *  - **GET** `/`   -   retrieve all policies (including their rules) or access requests
 *  - **POST** `/`  -   create new policy or access request
 */
export abstract class BaseHandler extends HttpHandler {

    protected readonly logger = getLoggerFor(this);
    
    /**
     * @param controller reference to the controller implementing the policy/access request logic
     * @param handleLogMessage message to log at the start of each handled request
     * @param patchContentType expected content type for PATCH requests (e.g. `application/json` or `application/sparql-update`)
     */
    constructor(
        protected readonly controller: BaseController,
        private readonly handleLogMessage: string,
        private readonly patchContentType: string,
    ) {
        super();
    }

    /**
     * Entry point for handling incoming HTTP requests.
     * Delegates to specific methods based on request method and presence of an `id` parameter.
     * 
     * @param context context containing the HTTP request
     * @returns HTTP response with appropriate status and body
     */
    public async handle({ request }: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
        this.logger.info(this.handleLogMessage);

        if (request.method === 'OPTIONS')
            return this.handleOptions();

        const credentials = verifyHttpCredentials(request);

        if (request.parameters?.id) {
            switch (request.method) {
                case 'GET': return this.handleSingleGet(request.parameters.id, credentials);
                case 'PATCH': return this.handlePatch(request as HttpHandlerRequest<string>, request.parameters.id, credentials);
                case 'PUT': return this.handlePut(request as HttpHandlerRequest<string>, request.parameters.id, credentials);
                case 'DELETE': return this.handleDelete(request.parameters.id, credentials);
                default: throw new MethodNotAllowedHttpError();
            }
        } else {
            switch (request.method) {
                case 'GET': return this.handleGet(credentials);
                case 'POST': return this.handlePost(request as HttpHandlerRequest<string>, credentials);
                default: throw new MethodNotAllowedHttpError();
            }
        }
    }

    /**
     * Handle a simple **OPTIONS** request to any of the specified endpoints.
     * Useful for CORS preflight requests.
     * 
     * @returns a response with status 204 and appropriate headers
     */
    private async handleOptions(): Promise<HttpHandlerResponse<any>> {
        const result = { status: 204 };
        return result;
    }

    /**
     * Retrieve a single policy (including its rules) or a single access request identified by `entityID`.
     * 
     * @param entityID ID pointing to the policy or access request
     * @param clientID ID pointing to the resource owner (RO) or requesting party (RP)
     * @returns a response with status (200 if found, 404 if not) and Turtle body containing the entity
     */
    private async handleSingleGet(entityID: string, clientID: string): Promise<HttpHandlerResponse<string>> {
        const { message, status } = await this.controller.getEntity(entityID, clientID);

        return {
            status: status,
            body: message
        };
    }

    /**
     * Handle a **PATCH** request for a single policy or access request identified by `entityID`.
     * Supports multiple patch content types, depending on `patchContentType`.
     * 
     * @param request HttpHandlerRequest containing the PATCH body
     * @param entityID ID of the policy or access request to patch
     * @param clientID ID pointing to the resource owner (RO) or requesting party (RP)
     * @returns a response with status code 204 if successful, or error status otherwise
     * @throws BadRequestHttpError if request body is missing or invalid
     */
    private async handlePatch(request: HttpHandlerRequest<string>, entityID: string, clientID: string): Promise<HttpHandlerResponse<void>> {
        let response = { status: 204, message: '' };

        if (!request.body) throw new BadRequestHttpError();
        if (this.patchContentType === 'application/json') {
            const body = JSON.parse(request.body);
            if (body.status) response = (await this.controller.patchEntity(entityID, body.status, clientID, false));
            else throw new BadRequestHttpError();
        } else response = (await this.controller.patchEntity(entityID, request.body, clientID));
        
        return response;
    }

    /**
     * Rewrite a single policy (including rules) or access request identified by `entityID`.
     * 
     * @param entityID ID pointing to the policy or access request
     * @param clientID ID pointing to the resource owner (RO) or requesting party (RP)
     * @returns a response with status 204 upon success
     */
    private async handlePut(request: HttpHandlerRequest<string>, entityID: string, clientID: string): Promise<HttpHandlerResponse<void>> {
        if (!request.body) throw new BadRequestHttpError();
        const { status } = await this.controller.putEntity(request.body.toString(), entityID, clientID);

        return {
            status: status
        };
    }

    /**
     * Remove a single policy (including rules) or access request identified by `entityID`.
     * 
     * @param entityID ID pointing to the policy or access request
     * @param clientID ID pointing to the resource owner (RO) or requesting party (RP)
     * @returns a response with status 204 if deletion was successful
     */
    private async handleDelete(entityID: string, clientID: string): Promise<HttpHandlerResponse<void>> {
        const { status } = await this.controller.deleteEntity(entityID, clientID);

        return {
            status: status
        };
    }

    /**
     * Retrieve all policies (including rules) or all access requests for a given `clientID`.
     * 
     * @param clientID ID pointing to the resource owner (RO) or requesting party (RP)
     * @returns a response with status (200 if found, 404 if not) and Turtle body containing all entities
     */
    private async handleGet(clientID: string): Promise<HttpHandlerResponse<string>> {
        const { status, message } = await this.controller.getEntities(clientID);

        return {
            status: status,
            body: message
        };
    }

    /**
     * Create a new policy (with at least one rule) or a new access request for a given `clientID`.
     * 
     * @param request HttpHandlerRequest containing RDF body representing the entity
     * @param clientID ID pointing to the resource owner (RO) or requesting party (RP)
     * @returns a response with status code 201 if successful, 409 if conflict occurred, or error otherwise
     * @throws BadRequestHttpError if request body is missing
     */
    private async handlePost(request: HttpHandlerRequest<string>, clientID: string): Promise<HttpHandlerResponse<void>> {
        if (!request.body) throw new BadRequestHttpError();
        const { status } = await this.controller.addEntity(request.body.toString(), clientID);

        return {
            status: status
        };
    }
}
