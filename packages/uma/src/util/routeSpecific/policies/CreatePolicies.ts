import { Store } from "n3";
import { HttpHandlerRequest, HttpHandlerResponse } from "../../http/models/HttpHandler";
import { namedNode, odrlAssigner, PolicyBody } from "./helpers";
import { BadRequestHttpError } from "@solid/community-server";
import { parseStringAsN3Store } from "koreografeye";

export async function addPolicies(request: HttpHandlerRequest, store: Store, clientId: string): Promise<HttpHandlerResponse<any>> {

    // 1. Parse the requested policy
    const requestedPolicy = (request as HttpHandlerRequest<PolicyBody>).body?.policy;
    if (typeof requestedPolicy !== 'string') {
        throw new BadRequestHttpError(`Invalid request body`);
    }
    const parsedPolicy: Store = await parseStringAsN3Store(requestedPolicy);

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

    // 3. Perform other validity checks

    // Check if assigner of the policy has access to the target

    // 4. Add the policy to the store
    store.addQuads(parsedPolicy.getQuads(null, null, null, null));

    return {
        status: 201
    }
}