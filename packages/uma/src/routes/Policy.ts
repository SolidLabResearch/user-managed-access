import { getLoggerFor } from "@solid/community-server";
import { UCRulesStorage } from "@solidlab/ucp";
import { HttpHandlerContext, HttpHandlerResponse, HttpHandler, HttpHandlerRequest } from "../util/http/models/HttpHandler";
import { Quad, Writer, DataFactory } from "n3";

// Need this for the 
const { namedNode } = DataFactory;

// ODRL implementation, notice that we currently give every policy where client is
// mentioned with 'permission', 'prohibition' and 'duty'.
const ordlAssigner = namedNode('http://www.w3.org/ns/odrl/2/assigner');
const relations = ['permission', 'prohibition', 'duty']

/**
 * Endpoint to handle policies, this implementation gives all policies that have the
 * client as assigner.
 */
export class PolicyRequestHandler extends HttpHandler {

    protected readonly logger = getLoggerFor(this);

    /**
     * Mock function to extract client from the request, because it is not known yet what
     * this request will look like in the future.
     * 
     * @param request the request with the client 'id' as body
     * @returns the client id
     */
    private getClient(request: HttpHandlerRequest): string {
        return request.body as string;
    }

    constructor(
        private readonly store: UCRulesStorage
    ) {
        super();
    }

    async handle({ request }: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
        this.logger.info(`Received policy request`);

        // Extract client from request
        const client = this.getClient(request);

        // TODO: verify authorization


        // Query the quads that have the requested client as assigner
        const store = await this.store.getStore();
        const quads = store.getQuads(null, ordlAssigner, namedNode(client), null);

        // For debug purposes
        // console.log(new Writer().quadsToString(quads));

        // For every rule that has `client` as `assigner`, get its policy
        const policies = new Set<string>();

        const rules = quads.map(quad => quad.subject);
        for (const relation of relations) {
            for (const rule of rules) {
                const foundPolicies = store.getQuads(null, namedNode(`http://www.w3.org/ns/odrl/2/${relation}`), rule, null);
                for (const quad of foundPolicies) {
                    policies.add(quad.subject.value);
                }
            }
        }

        return {
            status: 200,
            body: {
                policies: [...policies]
            }
        };
    }
}
