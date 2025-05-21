import { ConflictHttpError, NotFoundHttpError, RDF } from '@solid/community-server';
import { ODRL, ODRL_P, UCRulesStorage } from '@solidlab/ucp';
import { Store, DataFactory as DF, NamedNode, Quad_Subject, Quad_Object } from 'n3';
import { randomUUID } from 'node:crypto';
import {BadRequestHttpError} from '../util/http/errors/BadRequestHttpError';
import {HttpHandler} from '../util/http/models/HttpHandler';
import {HttpHandlerContext} from '../util/http/models/HttpHandlerContext';
import {HttpHandlerResponse} from '../util/http/models/HttpHandlerResponse';
import {UnauthorizedHttpError} from '../util/http/errors/UnauthorizedHttpError';
import {UnsupportedMediaTypeHttpError} from '../util/http/errors/UnsupportedMediaTypeHttpError';
import {Logger} from '../util/logging/Logger';
import {getLoggerFor} from '../util/logging/LoggerUtils';
import {KeyValueStore} from '../util/storage/models/KeyValueStore';
import {v4} from 'uuid';
import { HttpMethods } from '../util/http/models/HttpMethod';
import { MethodNotAllowedHttpError } from '../util/http/errors/MethodNotAllowedHttpError';
import { HttpHandlerRequest } from '../util/http/models/HttpHandlerRequest';
import { ResourceDescription } from '../views/ResourceDescription';
import { reType } from '../util/ReType';
import { extractRequestSigner, verifyRequest } from '../util/HttpMessageSignatures';

type ErrorConstructor = { new(msg: string): Error };

/**
 * Relation between a collection source and one of its parts.
 */
type RelationEntry = { relation: NamedNode, source: NamedNode, part: NamedNode };

/**
 * A ResourceRegistrationRequestHandler is tasked with implementing
 * section 3.2 from the User-Managed Access (UMA) Federated Auth 2.0.
 *
 * It provides an endpoint to a Resource Server for registering its resources.
 */
export class ResourceRegistrationRequestHandler implements HttpHandler {
  protected readonly logger: Logger = getLoggerFor(this);

  /**
   * @param resourceStore - Key/value store containing the {@link ResourceDescription}s.
   * @param policies - Policy store to contain the asset relation triples.
   */
  constructor(
    private readonly resourceStore: KeyValueStore<string, ResourceDescription>,
    private readonly policies: UCRulesStorage,
  ) {}

  /**
  * Handle incoming requests for resource registration
  * @param {HttpHandlerContext} param0
  * @return {Observable<HttpHandlerResponse<PermissionRegistrationResponse>>}
  */
  async handle({ request }: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    const signer = await extractRequestSigner(request);

    // TODO: check if signer is actually the correct one

    if (!await verifyRequest(request, signer)) {
      throw new UnauthorizedHttpError(`Failed to verify signature of <${signer}>`);
    }

    switch (request.method) {
      case HttpMethods.POST: return this.handlePost(request);
      case HttpMethods.PUT: return this.handlePut(request);
      case HttpMethods.DELETE: return this.handleDelete(request);
      default: throw new MethodNotAllowedHttpError();
    }
  }

  private async handlePost(request: HttpHandlerRequest): Promise<HttpHandlerResponse> {
    const { headers, body } = request;

    if (headers['content-type'] !== 'application/json') {
      throw new UnsupportedMediaTypeHttpError('Only Media Type "application/json" is supported for this route.');
    }

    try {
      reType(body, ResourceDescription);
    } catch (e) {
      this.logger.warn('Syntax error: ' + (e as Error).message, body);
      this.error(BadRequestHttpError, `Request has bad syntax${e instanceof Error ? ': ' + e.message : ''}`)
    }

    // We are using the name as the UMA identifier for now.
    // Reason being that there is not yet a good way to determine what the identifier would be when writing policies.
    let resource = body.name;
    if (resource) {
      if (await this.resourceStore.has(resource)) {
        throw new ConflictHttpError(
          `A resource with name ${resource} is already registered. Use PUT to update existing registrations.`,
        );
      }
    } else {
      resource = v4();
      this.logger.warn('No resource name was provided so a random identifier was generated.');
    }
    await this.resourceStore.set(resource, body);

    this.logger.info(`Registered resource ${resource}.`);

    // Store the new relations
    await this.updateRelations(resource, body);

    return ({
      status: 201,
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        _id: resource,
        user_access_policy_uri: 'TODO: implement policy UI',
      }),
    });
  }

  private async handlePut({ body, headers, parameters }: HttpHandlerRequest): Promise<HttpHandlerResponse> {
    if (typeof parameters?.id !== 'string') throw new Error('URI for PUT operation should include an id.');

    if (!await this.resourceStore.has(parameters.id)) {
      throw new NotFoundHttpError();
    }

    if (headers['content-type'] !== 'application/json') {
      throw new UnsupportedMediaTypeHttpError('Only Media Type "application/json" is supported for this route.');
    }

    try {
      reType(body, ResourceDescription);
    } catch (e) {
      this.logger.warn('Syntax error: ' + (e as Error).message, body);
      this.error(BadRequestHttpError, `Request has bad syntax${e instanceof Error ? ': ' + e.message : ''}`)
    }

    // Keep track of the previous description so we know which relations need to change
    const previousDescription = await this.resourceStore.get(parameters.id);

    await this.resourceStore.set(parameters.id, body);
    this.logger.info(`Updated resource ${parameters.id}.`);

    await this.updateRelations(parameters.id, body, previousDescription);

    return ({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        _id: parameters.id,
        user_access_policy_uri: 'TODO: implement policy UI',
      }),
    });
  }

  private async handleDelete({ parameters }: HttpHandlerRequest): Promise<HttpHandlerResponse> {
    if (typeof parameters?.id !== 'string') throw new Error('URI for DELETE operation should include an id.');

    if (!await this.resourceStore.has(parameters.id)) {
      throw new NotFoundHttpError();
    }

    await this.resourceStore.delete(parameters.id);
    this.logger.info(`Deleted resource ${parameters.id}.`);

    return ({
      status: 204,
      headers: {},
    });
  }

  /**
   * Updates the stored relations in the policy storage based on the given input.
   * @param id - UMA ID of the resource that changes.
   * @param description - The new {@link ResourceDescription} for the resource.
   * @param previous - The previous {@link ResourceDescription}, in case the resource was already registered previously.
   */
  protected async updateRelations(
    id: string,
    description: ResourceDescription,
    previous?: ResourceDescription
  ): Promise<void> {
    const add: Record<string, RelationEntry> = this.toRelationEntries(id, description);
    const remove: Record<string, RelationEntry> = this.toRelationEntries(id, previous);
    this.filterRelationEntries(add, remove);

    const policyStore = await this.policies.getStore();
    await this.policies.addRule(this.entriesToStore(Object.values(add), policyStore));
    await this.policies.removeData(this.entriesToStore(Object.values(remove), policyStore));
  }

  /**
   * Creates a unique key based on the {@link RelationEntry} values.
   */
  protected getRelationKey(entry: RelationEntry): string {
    return `${entry.source} ${entry.relation} ${entry.part}`;
  }

  /**
   * Converts the `resource_relation` fields to {@link RelationEntry} objects.
   * The keys of the object are generated with the `getRelationKey` function,
   * resulting in a unique, but non-random, key for every value.
   * @param id - UMA ID of the resource.
   * @param description - {@link ResourceDescription} to analyze, if there is one.
   */
  protected toRelationEntries(id: string, description?: ResourceDescription): Record<string, RelationEntry> {
    if (!description?.resource_relations) {
      return {};
    }

    const result: Record<string, RelationEntry> = {};
    for (let [ relation, targets ] of Object.entries(description.resource_relations)) {
      if (!targets || targets.length === 0) {
        continue;
      }
      const reverse = relation.startsWith('^');
      if (reverse) {
        relation = relation.slice(1);
      }
      const relationNode = DF.namedNode(relation);
      for (const target of targets) {
        const entry: RelationEntry = {
          relation: relationNode,
          part: DF.namedNode(reverse ? id : target),
          source: DF.namedNode(reverse ? target : id),
        };
        result[this.getRelationKey(entry)] = entry;
      }
    }
    return result;
  }

  /**
   */
  /**
   * Removes entries that are present in both maps.
   * These are the entries that remain unchanged.
   * It is assumed that matching values have the same keys.
   */
  protected filterRelationEntries(
    record1: Record<string, RelationEntry> = {},
    record2: Record<string, RelationEntry> = {},
  ): void {
    for (const key of Object.keys(record1)) {
      if (record2[key]) {
        delete record1[key];
        delete record2[key];
      }
    }
  }

  /**
   * Converts the given entries into triples to add or remove to/from the policy store.
   * @param entries - {@link RelationEntry} objects to parse.
   * @param policyStore - {@link Store} with the relevant triples to update.
   */
  protected entriesToStore(entries: RelationEntry[], policyStore: Store): Store {
    const store = new Store();
    for (const entry of entries) {
      const collectionIds = this.findCollectionIds(entry, policyStore);
      if (collectionIds.length === 0) {
        const collectionId = DF.namedNode(randomUUID());
        store.addQuad(DF.quad(collectionId, RDF.terms.type, ODRL.terms.AssetCollection));
        store.addQuad(DF.quad(collectionId, ODRL.terms.source, entry.source));
        store.addQuad(DF.quad(collectionId, ODRL_P.terms.relation, entry.relation));
        collectionIds.push(collectionId);
        this.logger.info(`Creating new AssetCollection ${collectionId.value} with source ${
          entry.source.value} and relation ${entry.relation.value}`);
      }
      collectionIds.push(...this.findRecursiveCollectionIds(entry.source, policyStore));

      // for (const collectionId of collectionIds) {
      //   store.addQuad(DF.quad(entry.part, ODRL.terms.partOf, collectionId));
      // }
      // TODO: the above code is correct, but the code below is currently needed because of a bug in the ODRL evaluator
      //       https://github.com/SolidLabResearch/ODRL-Evaluator/issues/8
      store.addQuad(DF.quad(entry.part, ODRL.terms.partOf, entry.source));
    }
    return store;
  }

  /**
   * Finds the identifiers of the collection(s) in the given {@link Store}
   * that match the requirements of the given {@link RelationEntry}.
   * @param entry - Relevant {@link RelationEntry}.
   * @param data - {@link Store} in which to find the matching triples.
   */
  protected findCollectionIds(entry: RelationEntry, data: Store): Quad_Subject[] {
    const sourceMatches = data.getSubjects(ODRL.terms.source, entry.source, null);
    return sourceMatches.filter((subject): boolean =>
      data.has(DF.quad(subject, ODRL_P.terms.relation, entry.relation)));
  }

  /**
   * Finds all collections that contain `part`,
   * or recursively contain the source of those collections.
   * @param part - Collection part.
   * @param data - {@link Store} in which to find the matching triples.
   */
  protected findRecursiveCollectionIds(part: Quad_Object, data: Store): Quad_Subject[] {
    const collectionIds = data.getObjects(part, ODRL.terms.partOf, null);
    const collectionSources = collectionIds.flatMap(
      (collectionId) => data.getObjects(collectionId, ODRL.terms.source, null));
    return [
      ...collectionIds,
      ...collectionSources.flatMap((collectionSource) => this.findRecursiveCollectionIds(collectionSource, data)),
    ].filter((id): boolean => id.termType !== 'Literal') as Quad_Subject[];
  }

  /**
   * Logs and throws an error
   *
   * @param {ErrorConstructor} constructor - the error constructor
   * @param {string} message - the error message
   */
  private error(constructor: ErrorConstructor, message: string): never {
    this.logger.warn(message);
    throw new constructor(message);
  }
}
