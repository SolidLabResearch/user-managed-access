import { BadRequestHttpError } from "@solid/community-server";
import { HttpHandlerRequest } from "../http/models/HttpHandler";

export const getAuthorizationHeader = (request: HttpHandlerRequest): string => {
    if (typeof request.headers['authorization'] === 'string')
        return request.headers['authorization'];
    else throw new BadRequestHttpError('Missing Authorization header');
}
