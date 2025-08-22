import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";

export async function updateAccessRequests(request: HttpHandlerRequest, client: string): Promise<HttpHandlerResponse<any>> {
    return {
        status: 200,
        body: ''
    }
}
