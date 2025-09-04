import { getLoggerFor, MethodNotAllowedHttpError } from "@solid/community-server";
import { BaseController } from "../controller/BaseController";
import { HttpHandler, HttpHandlerContext, HttpHandlerRequest, HttpHandlerResponse } from "../util/http/models/HttpHandler";
import { getAuthorizationHeader } from "../util/routeSpecific/middlewareUtil";

/**
 * Base handler for policy and access request endpoints
 * TODO: check name
 * TODO: check CORS handling with Joachim
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
        this.logger.info(request.toString());

        if (request.method === 'OPTIONS')
            return this.handleOptions(request);

        const client = getAuthorizationHeader(request);

        switch (request.method) {
            case 'GET'    : return { status: 200 };
            case 'POST'   : return { status: 200 };
            case 'DELETE' : return { status: 200 };
            case 'PATCH'  : return { status: 200 };
            case 'PUT'    : return { status: 200 };
            default: throw new MethodNotAllowedHttpError();
        }
    }

    private async handleOptions(request: HttpHandlerRequest): Promise<HttpHandlerResponse<any>> {
        return { status: 200 };
    }
}
