import { HttpHandlerRequest } from "../../http/models/HttpHandler";
import { checkBaseURL, retrieveID } from "./PolicyUtil";

export function policyOptions(request: HttpHandlerRequest, baseUrl: string) {
    try {
        retrieveID(checkBaseURL(request, baseUrl))
        return {
            status: 204,
            headers: {
                // this is only for the url with <encodedId>
                'Access-Control-Allow-Origin': 'http://localhost:5173',
                'Access-Control-Allow-Methods': 'GET, PATCH, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            }
        }

    } catch (error) {
        return {
            status: 204,
            headers: {
                // this is only for the url without <encodedId>
                'Access-Control-Allow-Origin': 'http://localhost:5173',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            }
        }

    }
}