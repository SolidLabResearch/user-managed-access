import { BadRequestHttpError } from "@solid/community-server";
import { HttpHandlerRequest } from "../http/models/HttpHandler";

/**
 * Check HTTP credentials for resource owner or requesting party.
 * Currently only fetches the content of the `authorization` header, but should be adapted in the future.
 * Goal: use one of the verification methods defined in packages/uma/src/credentials/verify
 * @param request HttpHandlerRequest to check credentials for
 * @returns credentials belonging to the resource owner or requesting party that made the request
 */
export const verifyHttpCredentials = (request: HttpHandlerRequest): string => {
    if (typeof request.headers['authorization'] === 'string')
        return request.headers['authorization'];
    else throw new BadRequestHttpError('Missing Authorization header');
}
