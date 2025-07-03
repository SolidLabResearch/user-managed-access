import { BadRequestHttpError, getLoggerFor } from "@solid/community-server";
import { UCRulesStorage } from "@solidlab/ucp";
import { HttpHandlerContext, HttpHandlerResponse, HttpHandler, HttpHandlerRequest } from "../util/http/models/HttpHandler";
import { DataFactory, Quad, Writer } from "n3";
import { ODRL } from "@solidlab/ucp";

const { namedNode } = DataFactory

// relevant ODRL implementations
const odrlAssigner = ODRL.terms.assigner;
const relations = [
    ODRL.terms.permission,
    ODRL.terms.prohibition,
    ODRL.terms.duty
]

/**
 * Endpoint to handle policies, this implementation gives all policies that have the
 * client as assigner.
 */
export class PolicyRequestHandler extends HttpHandler {

    protected readonly logger = getLoggerFor(this);

    constructor(
        private readonly store: UCRulesStorage
    ) {
        super();
    }

    /**
     * This function takes the GET-request with `Authorization: webID` and extracts the webID
     * (To be altered with actual Solid-OIDC)
     * 
     * @param request the request with the client 'id' as body
     * @returns the client id
     */
    protected getCredentials(request: HttpHandlerRequest): string {
        const header = request.headers['authorization'];
        if (typeof header !== 'string') {
            throw new BadRequestHttpError('Missing Authorization header');
        }
        return header;
    }

    /**
     * Get all policy information relevant to the client in the request.
     * This iplementation searches for all subjects in relation with the policy with depth 1, a deeper algorithm is required.
     * 
     * @param param0 a request with the clients webID as authorization header.
     * @returns all policy information (depth 1) relevant to the client
     */
    public async handle({ request }: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
        this.logger.info(`Received policy request`);

        // Extract client from request
        const client = this.getCredentials(request);

        // TODO: verify authorization

        // Query the quads that have the requested client as assigner
        const store = await this.store.getStore();
        const quads = store.getQuads(null, odrlAssigner, namedNode(client), null);

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

        // We use these policies to search everything about them, this will be changed to a recursive variant
        let policyDetails: Quad[] = [];

        for (const policy of policies) {
            const directQuads: Quad[] = store.getQuads(policy, null, null, null);
            const relatedQuads: Quad[] = [];
            for (const relation of relations) {
                const relatedNodes = store.getQuads(policy, relation, null, null);
                for (const q of relatedNodes) {
                    // Look at the rule in relation to the policy
                    const targetNode = q.object;
                    // Now find every quad over that rule, without check if the rule is assigned by our client
                    relatedQuads.push(...store.getQuads(targetNode, null, null, null));
                }
            }
            policyDetails = policyDetails.concat([...directQuads, ...relatedQuads]);
        }

        // Serialize as Turtle
        const writer = new Writer({ format: 'Turtle' });
        writer.addQuads(policyDetails);

        return new Promise<HttpHandlerResponse<any>>((resolve, reject) => {
            writer.end((error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({
                        status: 200,
                        headers: { 'content-type': 'text/turtle' },
                        body: result
                    });
                }
            });
        });
    }
}
