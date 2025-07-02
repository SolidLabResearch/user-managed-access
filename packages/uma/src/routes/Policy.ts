import { getLoggerFor } from "@solid/community-server";
import { UCRulesStorage } from "@solidlab/ucp";
import { HttpHandlerContext, HttpHandlerResponse, HttpHandler, HttpHandlerRequest } from "../util/http/models/HttpHandler";
import { Quad, Writer, DataFactory } from "n3";
import { ODRL } from "../../../ucp/src/util/Vocabularies";

// Need this to query
const { namedNode } = DataFactory;

// relevant ODRL implementations
const ordlAssigner = ODRL.terms.assigner;
const relations = [ODRL.terms.permission, ODRL.terms.prohibition, ODRL.terms.duty]

/**
 * Endpoint to handle policies, this implementation gives all policies that have the
 * client as assigner.
 */
export class PolicyRequestHandler extends HttpHandler {

    protected readonly logger = getLoggerFor(this);

    /**
     * This function takes the GET-request with `Authorization: webID` and extracts the webID
     * (To be altered with actual Solid-OIDC)
     * 
     * @param request the request with the client 'id' as body
     * @returns the client id
     */
    private getClient(request: HttpHandlerRequest): string {
        const header = request.headers['authorization'];
        if (!header) {
            throw new Error('Missing Authorization header');
        }
        return header as string;

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
                const foundPolicies = store.getQuads(null, relation, rule, null);
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
