import { Store } from "n3";
import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { namedNode, odrlAssigner, PolicyBody } from "./helpers";
import { BadRequestHttpError, InternalServerError } from "@solid/community-server";
import { parseStringAsN3Store } from "koreografeye";
import { UCRulesStorage } from "@solidlab/ucp";

export async function addPolicies(request: HttpHandlerRequest, store: Store, storage: UCRulesStorage, clientId: string): Promise<HttpHandlerResponse<any>> {

    // 1. Parse the requested policy
    const contentType = request.headers['content-type'] ?? 'turtle';

    // Regex check for content type
    if (/(?:n3|trig|turtle|nquads?|ntriples?)$/i.test(contentType)) {
        throw new BadRequestHttpError(`Content-Type ${contentType} is not supported.`);
    }

    const requestedPolicy = request.body;
    if (typeof requestedPolicy !== 'string') {
        throw new BadRequestHttpError(`Invalid request body`);
    }
    let parsedPolicy: Store;
    try {
        parsedPolicy = await parseStringAsN3Store(requestedPolicy, { format: contentType });
    } catch (error) {
        throw new BadRequestHttpError(`Policy string can not be parsed: ${error}`)
    }

    // 2. Check if assigner is client
    const matchingClient = parsedPolicy.getQuads(null, odrlAssigner, namedNode(clientId), null);
    if (matchingClient.length === 0) {
        throw new BadRequestHttpError(`Policy is not authorized correctly`);
    }

    // This check works if the 'assigner' relation only applies to rules of a policy
    const allAssigners = parsedPolicy.getQuads(null, odrlAssigner, null, null);
    if (allAssigners.length !== matchingClient.length) {
        throw new BadRequestHttpError(`Policy is incorrectly built`);
    }

    // TODO: 3. Perform other validity checks

    // Check if assigner of the policy has access to the target
    // Check if there is at least one permission/prohibition/duty
    // Check if every rule has a target
    // ...

    // 4. Add the policy to the rule storage
    try {
        await storage.addRule(parsedPolicy);
    } catch (error) {
        throw new InternalServerError("Failed to add policy");
    }


    return {
        status: 201,
        body: { message: "Policy stored successfully" }
    }
}