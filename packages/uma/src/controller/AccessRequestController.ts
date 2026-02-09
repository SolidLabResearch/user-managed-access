import { QueryEngine } from '@comunica/query-sparql';
import { Quad } from '@rdfjs/types';
import {
    BadRequestHttpError,
    ConflictHttpError,
    createErrorMessage,
    ForbiddenHttpError,
    InternalServerError,
    KeyValueStorage,
    NotFoundHttpError,
    RDF
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { DataFactory as DF, Parser, Quad_Object, Quad_Subject, Store } from 'n3';
import { randomUUID } from 'node:crypto';
import { ODRL } from 'odrl-evaluator';
import { stringToTerm, termToString } from 'rdf-string';
import { UCRulesStorage } from '../ucp/storage/UCRulesStorage';
import { SOTW } from '../ucp/util/Vocabularies';
import { array, optional as $, reType, string, tuple, Type } from '../util/ReType';
import { Permission } from '../views/Permission';
import { BaseController } from './BaseController';

export const AccessRequest = {
    resource_id: string,
    resource_scopes: array(string),
    constraints: $(array(tuple(string, string, string))),
};

export type AccessRequest = Type<typeof Permission>;

/**
 * Controller for routes concerning access requests
 */
export class AccessRequestController extends BaseController {
    protected readonly logger = getLoggerFor(this);

    protected readonly queryEngine = new QueryEngine();

    constructor(
        protected readonly store: UCRulesStorage,
        protected readonly ownershipStore: KeyValueStorage<string, string[]>,
    ) {
        super(
            store,
            // TODO: is this horrible? yes, but this entire architecture needs a rework anyway
            null as any,
            null as any,
            null as any,
            null as any,
            null as any,
        );
        this.sanitizeGets = this.getAccessRequests.bind(this);
        this.sanitizeGet = this.getAccessRequest.bind(this);
        this.sanitizePatch = this.patchAccessRequest.bind(this);
    }

    public async deleteEntity(entityID: string, clientID: string): Promise<{ status: number }> {
        // Not defined who should be allowed to delete requests
        // TODO: perhaps might make sense to allow deletion by requester when status is still "requested"
        throw new ForbiddenHttpError();
    }

    public async putEntity(data: string, entityID: string, clientID: string): Promise<{ status: number }> {
        // Changing requests is not allowed
        throw new ForbiddenHttpError();
    }

    public async addEntity(data: string, clientID: string): Promise<{ status: number, id: string }> {
        let json: AccessRequest;
        // TODO: assuming input is JSON here for now
        try {
            json = JSON.parse(data);
            reType(json, AccessRequest);
        } catch (e) {
            this.logger.warn(`Syntax error: ${createErrorMessage(e)}, ${data}`);
            throw new BadRequestHttpError(`Request has bad syntax: ${createErrorMessage(e)}`);
        }

        if (json.resource_scopes.length === 0) {
            throw new BadRequestHttpError('Missing scopes');
        }

        const subject = DF.namedNode(`http://example.org/${randomUUID()}`);
        const request = new Store();
        request.addQuads([
            DF.quad(subject, RDF.terms.type, SOTW.terms.EvaluationRequest),
            // TODO: should verify this resource exists (and also remove requests if resources no longer exist)
            DF.quad(subject, SOTW.terms.requestedTarget, DF.namedNode(json.resource_id)),
            DF.quad(subject, SOTW.terms.requestingParty, DF.namedNode(clientID)),
            DF.quad(subject, SOTW.terms.requestStatus, SOTW.terms.requested),
            ...json.resource_scopes.map((scope) => DF.quad(subject, SOTW.terms.requestedAction, DF.namedNode(scope))),
        ]);
        let constraintIdx = 0;
        for (const constraint of json.constraints ?? []) {
            const terms = constraint.map((str) => stringToTerm(str)) as Quad_Object[];
            const constraintSubject = DF.namedNode(subject.value + `-constraint-${++constraintIdx}`);
            request.addQuads([
                DF.quad(subject, ODRL.terms.constraint, constraintSubject),
                DF.quad(constraintSubject, RDF.terms.type, ODRL.terms.Constraint),
                DF.quad(constraintSubject, ODRL.terms.leftOperand, terms[0]),
                DF.quad(constraintSubject, ODRL.terms.operator, terms[1]),
                DF.quad(constraintSubject, ODRL.terms.rightOperand, terms[2]),
            ]);
        }

        await this.store.addRule(request);

        this.logger.info(`Created request ${subject.value} for ${clientID} with values ${JSON.stringify(data)}`);

        return { status: 201, id: subject.value };
    }

    // Find access requests where clientId is the requester or the owner of the targeted resource
    protected async getAccessRequests(store: Store, clientId: string): Promise<Store> {
        const result = new Store();

        // Find requested queries
        const requestedSparql = `        
            SELECT DISTINCT ?req
            WHERE { ?req <https://w3id.org/force/sotw#requestingParty> <${clientId}> }`;
        const requestedStream = await this.queryEngine.queryBindings(requestedSparql, { sources: [store] });
        for await (const binding of requestedStream) {
            result.addAll(this.getRequestQuads(store, binding.get('req') as Quad_Subject));
        }

        // Find queries over owned resources
        const resources = await this.ownershipStore.get(clientId);
        if (resources && resources.length > 0) {
            // TODO: assuming resource ID is an IRI
            const ownedSparql = `
            SELECT DISTINCT ?req
            WHERE {
              VALUES (?resource) {
                ${resources.map((res) => `(<${res}>)`).join('\n')}
              }
              ?req <https://w3id.org/force/sotw#requestedTarget> ?resource .
            }`;
            const requestedStream = await this.queryEngine.queryBindings(ownedSparql, { sources: [store] });
            for await (const binding of requestedStream) {
                result.addAll(this.getRequestQuads(store, binding.get('req') as Quad_Subject));
            }
        }

        return result;
    }

    protected async getAccessRequest(store: Store, requestID: string, clientID: string): Promise<Store> {
        const requestNode = DF.namedNode(requestID);
        const requesters = store.getObjects(requestNode, SOTW.terms.requestingParty, null);
        if (requesters.length === 0) {
            throw new NotFoundHttpError();
        }

        let allowedToSee = requesters.some((requester) => requester.value === clientID);
        if (!allowedToSee) {
            // Maybe the client is the owner instead of the requester
            const targets = store.getObjects(requestNode, SOTW.terms.requestedTarget, null);
            if (targets.length !== 1) {
                throw new InternalServerError(`Unexpected amount of targets, expected 1 but got ${targets.length}`);
            }
            const ownedResources = await this.ownershipStore.get(clientID) ?? [];
            allowedToSee = ownedResources.includes(targets[0].value);
        }

        if (!allowedToSee) {
            throw new ForbiddenHttpError();
        }

        return new Store(this.getRequestQuads(store, requestNode));
    }

    protected async patchAccessRequest(store: Store, requestID: string, clientID: string, patchInformation: string):
        Promise<void> {
        const requestNode = DF.namedNode(requestID);
        const targets = store.getObjects(requestNode, SOTW.terms.requestedTarget, null);
        if (targets.length === 0) {
            throw new NotFoundHttpError();
        }

        if (patchInformation !== 'accepted' && patchInformation !== 'denied') {
            throw new BadRequestHttpError('Status needs to be "accepted" or "denied"');
        }

        const ownedResources = await this.ownershipStore.get(clientID);
        if (!ownedResources?.includes(targets[0].value)) {
            throw new ForbiddenHttpError();
        }

        const statuses = store.getObjects(requestNode, SOTW.terms.requestStatus, null);
        if (statuses.length !== 1) {
            throw new InternalServerError(`Expected 1 status for ${requestID} but found ${statuses.length}`);
        }
        if (!statuses[0].equals(SOTW.terms.requested)) {
            throw new ConflictHttpError(`Request was already resolved`);
        }

        const actions = store.getObjects(requestNode, SOTW.terms.requestedAction, null);
        const parties = store.getObjects(requestNode, SOTW.terms.requestingParty, null);

        if (actions.length === 0 || parties.length !== 1) {
            throw new InternalServerError(`Invalid actions (${actions.map(termToString)}) or parties (${
                parties.map(termToString)})`);
        }

        store.removeQuad(DF.quad(requestNode, SOTW.terms.requestStatus, SOTW.terms.requested));
        store.addQuad(DF.quad(requestNode, SOTW.terms.requestStatus, SOTW.terms[patchInformation]));

        this.logger.info(`Updated status of request ${requestNode.value} to ${patchInformation}`)
        if (patchInformation === 'accepted') {
            const policyNode = DF.namedNode(`http://example.org/${randomUUID()}`);
            const permissionNode = DF.namedNode(policyNode.value + '-permission');
            store.addQuads([
                DF.quad(policyNode, RDF.terms.type, ODRL.terms.Agreement),
                DF.quad(policyNode, ODRL.terms.uid, policyNode),
                DF.quad(policyNode, ODRL.terms.permission, permissionNode),
                DF.quad(permissionNode, RDF.terms.type, ODRL.terms.Permission),
                ...actions.map((action) => DF.quad(permissionNode, ODRL.terms.action, action)),
                DF.quad(permissionNode, ODRL.terms.target, targets[0]),
                DF.quad(permissionNode, ODRL.terms.assignee, parties[0]),
                DF.quad(permissionNode, ODRL.terms.assigner, DF.namedNode(clientID)),
                ...store.getObjects(requestNode, ODRL.terms.constraint, null).flatMap((constraint) => [
                    DF.quad(permissionNode, ODRL.terms.constraint, constraint),
                    ...store.getQuads(constraint, null, null, null),
                ]),
            ]);
            this.logger.info(
              `Created policy ${policyNode.value} in response to request ${requestNode.value} being accepted`);
        }
    }

    /**
     * Returns all the quads related to the given request.
     */
    protected getRequestQuads(store: Store, subject: Quad_Subject): Quad[] {
        const quads = store.getQuads(subject, null, null, null);
        // Constraints go a level deeper
        const constraints = store.getObjects(subject, ODRL.terms.constraint, null);
        for (const constraint of constraints) {
            quads.push(...store.getQuads(constraint, null, null, null));
        }
        return quads;
    }
}
