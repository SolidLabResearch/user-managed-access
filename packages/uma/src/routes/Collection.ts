import { Quad } from '@rdfjs/types';
import {
  BadRequestHttpError,
  createErrorMessage,
  ForbiddenHttpError,
  joinUrl,
  KeyValueStorage,
  MethodNotAllowedHttpError,
  NotFoundHttpError,
  RDF
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { DataFactory as DF, NamedNode, Store } from 'n3';
import { randomUUID } from 'node:crypto';
import { ODRL } from 'odrl-evaluator';
import { WEBID } from '../credentials/Claims';
import { CredentialParser } from '../credentials/CredentialParser';
import { Verifier } from '../credentials/verify/Verifier';
import { UCRulesStorage } from '../ucp/storage/UCRulesStorage';
import { DC, ODRL_P, OWL } from '../ucp/util/Vocabularies';
import { writeStore } from '../util/ConvertUtil';
import {
  HttpHandler,
  HttpHandlerContext,
  HttpHandlerRequest,
  HttpHandlerResponse
} from '../util/http/models/HttpHandler';
import { array, optional as $, reType, string, Type, union } from '../util/ReType';

export const AssetCollectionDescription = {
  description: $(string),
  type: 'asset' as const,
  parts: array(string),
}
export type AssetCollectionDescription = Type<typeof AssetCollectionDescription>;

export const PartyCollectionDescription = {
  description: $(string),
  type: 'party' as const,
  owners: array(string),
  parts: array(string),
}
export type PartyCollectionDescription = Type<typeof PartyCollectionDescription>;

export const CollectionDescription = union(AssetCollectionDescription, PartyCollectionDescription);
export type CollectionDescription = Type<typeof CollectionDescription>;

/**
 * Handles all CRUD interactions for collections.
 */
export class CollectionRequestHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    protected readonly credentialParser: CredentialParser,
    protected readonly verifier: Verifier,
    protected readonly ownershipStore: KeyValueStorage<string, string[]>,
    protected readonly policies: UCRulesStorage,
  ) {
    super();
  }

  public async handle({ request }: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    const credential = await this.credentialParser.handleSafe(request);
    const claims = await this.verifier.verify(credential);
    const userId = claims[WEBID];
    if (typeof userId !== 'string') {
      throw new ForbiddenHttpError(`Missing claim ${WEBID}.`);
    }

    switch (request.method) {
      case 'GET': return this.handleGet(request, userId);
      case 'POST': return this.handlePost(request, userId);
      case 'PUT': return this.handlePut(request, userId);
      case 'DELETE': return this.handleDelete(request, userId);
      default: throw new MethodNotAllowedHttpError([ request.method ]);
    }
  }

  protected async handleGet(request: HttpHandlerRequest, userId: string): Promise<HttpHandlerResponse> {
    const collections: NamedNode[] = [];
    const userNode = DF.namedNode(userId);
    const store = await this.policies.getStore();
    // A parsed ID indicates that this is not the root collection URL, so a specific collection is being targeted
    if (request.parameters?.id) {
      // Verify ownership
      const subject = DF.namedNode(request.url.href);
      await this.verifyOwnership(subject, userId, store);
      collections.push(subject);
    } else {
      collections.push(...store.getSubjects(DC.terms.creator, userNode, null) as NamedNode[]);
    }

    const result = new Store();
    for (const collection of collections) {
      result.addQuads(store.getQuads(collection, null, null, null));
      result.addQuads(store.getQuads(null, ODRL.terms.partOf, collection, null));
      // Inverse relations triples are not covered by the above and need to additionally be added
      const relations = result.getObjects(collection, ODRL_P.terms.relation, null);
      for (const relation of relations) {
        result.addQuads(store.getQuads(relation, OWL.terms.inverseOf, null, null));
      }
    }

    return {
      status: 200,
      headers: { 'content-type': 'text/turtle' },
      body: await writeStore(result, { dc: DC.terms.namespace, odrl: ODRL.terms.namespace }),
    }
  }

  protected async handlePost(request: HttpHandlerRequest, userId: string): Promise<HttpHandlerResponse> {
    const subject = DF.namedNode(joinUrl(request.url.href, randomUUID()));
    const quads = await this.descriptionToQuads(request.body, userId, subject);
    const store = new Store(quads);

    // Store collection triples
    await this.policies.addRule(store);

    return {
      status: 201,
      headers: { location: subject.value },
    };
  }

  protected async handlePut(request: HttpHandlerRequest, userId: string): Promise<HttpHandlerResponse> {
    if (!request.parameters?.id) {
      throw new MethodNotAllowedHttpError([ 'PUT' ]);
    }

    const subject = DF.namedNode(request.url.href);
    const policyStore = await this.policies.getStore();
    if (policyStore.getObjects(subject, ODRL_P.terms.relation, null).length > 0) {
      throw new ForbiddenHttpError(`Relation collections can not be modified`);
    }
    await this.verifyOwnership(subject, userId, policyStore);

    const newStore = new Store(await this.descriptionToQuads(request.body, userId, subject));
    const oldStore = new Store([
      ...policyStore.getQuads(subject, null, null, null),
      ...policyStore.getQuads(null, ODRL.terms.partOf, subject, null)
    ]);

    const add = newStore.difference(oldStore);
    const remove = oldStore.difference(newStore);

    if (add.size > 0) {
      await this.policies.addRule(add as Store);
    }
    if (remove.size > 0) {
      await this.policies.removeData(remove as Store);
    }

    return { status: 204 };
  }

  protected async handleDelete(request: HttpHandlerRequest, userId: string): Promise<HttpHandlerResponse> {
    if (!request.parameters?.id) {
      throw new MethodNotAllowedHttpError([ 'DELETE' ]);
    }
    const subject = DF.namedNode(request.url.href);
    const policyStore = await this.policies.getStore();
    if (policyStore.getObjects(subject, ODRL_P.terms.relation, null).length > 0) {
      throw new ForbiddenHttpError(`Relation collections can not be modified`);
    }
    await this.verifyOwnership(subject, userId, policyStore);

    const collectionQuads = new Store([
      ...policyStore.getQuads(subject, null, null, null),
      ...policyStore.getQuads(null, ODRL.terms.partOf, subject, null)
    ]);

    await this.policies.removeData(collectionQuads);

    return { status: 204 };
  }

  /**
   * Verifies if the user is allowed to modify the given collection.
   */
  protected async verifyOwnership(subject: NamedNode, userId: string, store?: Store): Promise<void> {
    const userNode = DF.namedNode(userId);
    store = store ?? await this.policies.getStore();

    const owners = store.getObjects(subject, DC.terms.creator, null);
    if (owners.length === 0) {
      throw new NotFoundHttpError();
    }
    if (!owners.some(owner => owner.equals(userNode))) {
      throw new ForbiddenHttpError(`${userId} is not an owner of this collection`);
    }
  }

  protected async descriptionToQuads(body: unknown, userId: string, subject: NamedNode): Promise<Quad[]> {
    try {
      reType(body, CollectionDescription);
    } catch (e) {
      this.logger.warn(`Syntax error: ${createErrorMessage(e)}, ${body}`);
      throw new BadRequestHttpError(`Request has bad syntax: ${createErrorMessage(e)}`);
    }

    if (body.type === 'party') {
      // Make sure the user is in the owners array
      if (!body.owners.includes(userId)) {
        this.logger.warn(`Trying to make a collection where the requester, ${userId}, is not an owner`);
        throw new BadRequestHttpError(
          'To prevent being locked out, the identity performing this request needs to be an owner');
      }
    } else {
      const owned = await this.ownershipStore.get(userId) ?? [];
      for (const asset of body.parts) {
        if (!owned.includes(asset)) {
          this.logger.warn(`Creating asset collection with unowned resource ${asset}`);
          throw new ForbiddenHttpError(`Creating asset collection with unowned resource ${asset}`);
        }
      }
    }

    // Generate all necessary collection triples
    return [
      DF.quad(subject, RDF.terms.type, body.type === 'asset' ? ODRL.terms.AssetCollection : ODRL.terms.PartyCollection),
      ...body.description ? [ DF.quad(subject, DC.terms.description, DF.literal(body.description)) ] : [],
      ...body.type === 'party' ?
        body.owners.map(owner => DF.quad(subject, DC.terms.creator, DF.namedNode(owner))) :
        [ DF.quad(subject, DC.terms.creator, DF.namedNode(userId)) ],
      ...body.parts.map(part => DF.quad(DF.namedNode(part), ODRL.terms.partOf, subject)),
    ];
  }
}
