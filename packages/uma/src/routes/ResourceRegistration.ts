import {
  BadRequestHttpError,
  ConflictHttpError,
  createErrorMessage,
  ForbiddenHttpError,
  InternalServerError,
  joinUrl,
  MethodNotAllowedHttpError,
  NotFoundHttpError,
  RDF,
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { DataFactory as DF, NamedNode, Quad, Quad_Subject, Store } from 'n3';
import { randomUUID } from 'node:crypto';
import { UCRulesStorage } from '../ucp/storage/UCRulesStorage';
import { ODRL, ODRL_P, OWL } from '../ucp/util/Vocabularies';
import {
  HttpHandler,
  HttpHandlerContext,
  HttpHandlerRequest,
  HttpHandlerResponse
} from '../util/http/models/HttpHandler';
import { RequestValidator } from '../util/http/validate/RequestValidator';
import { RegistrationStore } from '../util/RegistrationStore';
import { reType } from '../util/ReType';
import { ResourceDescription } from '../views/ResourceDescription';

/**
 * The necessary metadata to describe an asset collection based on a relation.
 */
export type CollectionMetadata = { relation: NamedNode, source: NamedNode, reverse: boolean };

/**
 * A ResourceRegistrationRequestHandler is tasked with implementing
 * section 3.2 from the User-Managed Access (UMA) Federated Auth 2.0.
 *
 * It provides an endpoint to a Resource Server for registering its resources.
 */
export class ResourceRegistrationRequestHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  /**
   * @param registrationStore - Key/value store containing the {@link ResourceDescription}s.
   * @param policies - Policy store to contain the asset relation triples.
   * @param validator - Validates that the request is valid.
   */
  constructor(
    protected readonly registrationStore: RegistrationStore,
    protected readonly policies: UCRulesStorage,
    protected readonly validator: RequestValidator,
  ) {
    super();
  }

  public async handle({ request }: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    const { owner } = await this.validator.handleSafe({ request });

    switch (request.method) {
      case 'POST': return this.handlePost(request, owner);
      case 'PUT': return this.handlePut(request, owner);
      case 'DELETE': return this.handleDelete(request, owner);
      default: throw new MethodNotAllowedHttpError([ request.method ]);
    }
  }

  protected async handlePost(request: HttpHandlerRequest, owner: string): Promise<HttpHandlerResponse> {
    const { body } = request;

    try {
      reType(body, ResourceDescription);
    } catch (e) {
      this.logger.warn(`Syntax error: ${createErrorMessage(e)}, ${body}`);
      throw new BadRequestHttpError(`Request has bad syntax: ${createErrorMessage(e)}`);
    }

    // We are using the name as the UMA identifier for now.
    // Reason being that there is not yet a good way to determine what the identifier would be when writing policies.
    let resource = body.name;
    if (resource) {
      if (await this.registrationStore.has(resource)) {
        throw new ConflictHttpError(
          `A resource with name ${resource} is already registered. Use PUT to update existing registrations.`,
        );
      }
    } else {
      resource = randomUUID();
      this.logger.warn('No resource name was provided so a random identifier was generated.');
    }

    // Set the resource metadata
    await this.setResourceMetadata(resource, body, owner);

    return ({
      status: 201,
      headers: { location: `${joinUrl(request.url.href, encodeURIComponent(resource))}` },
      body: {
        _id: resource,
        user_access_policy_uri: 'TODO: implement policy UI',
      },
    });
  }

  protected async handlePut({ body, parameters }: HttpHandlerRequest, owner: string): Promise<HttpHandlerResponse> {
    if (typeof parameters?.id !== 'string') {
      throw new InternalServerError('URI for PUT operation should include an id.');
    }

    const entry = await this.registrationStore.get(parameters.id);
    if (!entry) {
      throw new NotFoundHttpError();
    }

    if (entry.owner !== owner) {
      throw new ForbiddenHttpError(`${owner} is not the owner of this resource.`);
    }

    try {
      reType(body, ResourceDescription);
    } catch (e) {
      this.logger.warn(`Syntax error: ${createErrorMessage(e)}, ${body}`);
      throw new BadRequestHttpError(`Request has bad syntax: ${createErrorMessage(e)}`);
    }

    // Update the resource metadata
    await this.setResourceMetadata(parameters.id, body, owner, entry.description);

    return ({
      status: 200,
      body: {
        _id: parameters.id,
        user_access_policy_uri: 'TODO: implement policy UI',
      },
    });
  }

  protected async handleDelete({ parameters }: HttpHandlerRequest, owner: string): Promise<HttpHandlerResponse> {
    if (typeof parameters?.id !== 'string') {
      throw new InternalServerError('URI for DELETE operation should include an id.');
    }

    const entry = await this.registrationStore.get(parameters.id);
    if (!entry) {
      throw new NotFoundHttpError('Registration to be deleted does not exist (id unknown).');
    }

    if (entry.owner !== owner) {
      throw new ForbiddenHttpError(`${owner} is not the owner of this resource.`);
    }

    await this.registrationStore.delete(parameters.id);
    this.logger.info(`Deleted resource ${parameters.id}.`);

    return ({ status: 204 });
  }

  /**
   * Updates all asset collection and relation metadata for the given resource based on an updated description.
   * @param id - The identifier of the resource.
   * @param description - The new {@link ResourceDescription} for the resource.
   * @param owner - The owner of the resource.
   * @param previous - The previously stored {@link ResourceDescription}, if there is one.
   */
  protected async setResourceMetadata(id: string, description: ResourceDescription, owner: string,
    previous?: ResourceDescription): Promise<void> {
    const policyStore = await this.policies.getStore();
    const collectionQuads = await this.updateCollections(policyStore, id, description, previous);
    const relationQuads = await this.updateRelations(policyStore, id, description, previous);
    const addQuads = [ ...collectionQuads.add, ...relationQuads.add ];
    if (addQuads.length > 0) {
      await this.policies.addRule(new Store([...collectionQuads.add, ...relationQuads.add]));
    }
    const removeQuads = [ ...collectionQuads.remove, ...relationQuads.remove ];
    if (removeQuads.length > 0) {
      await this.policies.removeData(new Store([...collectionQuads.remove, ...relationQuads.remove]));
    }

    // Store the new UMA ID (or update the contents of the existing one)
    // Note that we only do this after generating and updating the relation metadata,
    // as errors could be thrown there.
    await this.registrationStore.set(id, { description, owner });
    this.logger.info(`Updated registration for ${id}.`);
  }

  /**
   * Updates the existing asset collection metadata, based on the new resource description.
   *
   * @param policyStore - RDF store that contains all the know collection metadata.
   * @param id - The identifier of the resource.
   * @param description - The new {@link ResourceDescription} for the resource.
   * @param previous - The previous {@link ResourceDescription}, in case this is an update.
   */
  protected async updateCollections(
    policyStore: Store,
    id: string,
    description: ResourceDescription,
    previous?: ResourceDescription
  ): Promise<{ add: Quad[], remove: Quad[] }> {
    const add: Record<string, CollectionMetadata> = this.getCollectionMetadata('resource_defaults', description, id);
    const remove: Record<string, CollectionMetadata> = this.getCollectionMetadata('resource_defaults', previous, id);
    this.filterRelationEntries(add, remove);

    // Add new collection triples
    const addQuads: Quad[] = [];
    for (const [ key, entry ] of Object.entries(add)) {
      const collections = this.findCollectionIds(entry, policyStore);
      if (collections.length > 1) {
        this.logger.error(
          `Found multiple collections for ${JSON.stringify(entry)}: ${collections.map((col) => col.value)}`
        );
      }
      // Ignore collections that already exist
      if (collections.length > 0) {
        delete add[key];
      } else {
        addQuads.push(...this.generateCollectionTriples(entry));
      }
    }

    // Remove old collection triples if the collections are empty.
    const removeQuads: Quad[] = [];
    for (const entry of Object.values(remove)) {
      const collections = this.findCollectionIds(entry, policyStore);
      for (const collection of collections) {
        // Make sure that collections that need to be removed are empty
        if (policyStore.countQuads(null, ODRL.terms.partOf, collection, null) > 0) {
          throw new ConflictHttpError(`Unable to remove collection ${collection.value} as it is not empty.`);
        }
        removeQuads.push(...this.generateCollectionTriples(entry, collection));
      }
    }

    return {
      add: addQuads,
      remove: removeQuads,
    };
  }

  /**
   * Updates the relations to asset collections for the given resource.
   *
   * @param policyStore - RDF store that contains all the know collection metadata.
   * @param id - The identifier of the resource.
   * @param description - The new {@link ResourceDescription} for the resource.
   * @param previous - The previous {@link ResourceDescription}, in case this is an update.
   */
  protected async updateRelations(
    policyStore: Store,
    id: string,
    description: ResourceDescription,
    previous?: ResourceDescription
  ): Promise<{ add: Quad[], remove: Quad[] }> {
    const add: Record<string, CollectionMetadata> = this.getCollectionMetadata('resource_relations', description, id);
    const remove: Record<string, CollectionMetadata> = this.getCollectionMetadata('resource_relations', previous, id);
    this.filterRelationEntries(add, remove);

    const part = DF.namedNode(id);
    return {
      add: this.generatePartOfTriples(part, Object.values(add), policyStore),
      remove: this.generatePartOfTriples(part, Object.values(remove), policyStore),
    };
  }

  /**
   * Extract the relation metadata found in a resource description for the given field.
   * @param field - One of the two fields that can contain relation metadata.
   * @param description - The description to extract the info from.
   * @param id - The identifier of the resource. This is only relevant for the `resource_defaults` field.
   */
  protected getCollectionMetadata(
    field: 'resource_defaults' | 'resource_relations',
    description?: ResourceDescription,
    id?: string,
  ): Record<string, CollectionMetadata> {
    if (!description?.[field]) {
      return {};
    }

    const result: { normal: NodeJS.Dict<string[]>, reverse: NodeJS.Dict<string[]> } = {
      normal: { ...description[field] } as NodeJS.Dict<string[]>,
      reverse: description[field]['@reverse'] as NodeJS.Dict<string[]> ?? {}
    }
    delete result.normal['@reverse'];

    const sourceId = field === 'resource_defaults' ? id : undefined;
    return {
      // Note that for resource_relations, we want to find the collections this resource is part of,
      // so we need to find the collection metadata defining those collections.
      // E.g., if this resource has relation `L` to resource `R`,
      // we need the collection metadata with source `R` and relation `reverse(L)`.
      ...this.entriesToCollectionMetadata(result.normal, field === 'resource_relations', sourceId),
      ...this.entriesToCollectionMetadata(result.reverse, field === 'resource_defaults', sourceId),
    };
  }

  /**
   * Converts resource_defaults/resource_relations entries to {@link CollectionMetadata entries}.
   * @param entries - The key/value object as described for the corresponding field.
   * @param reverse - If these are reverse relations (aka, found in the @reverse block of the description).
   * @param id - The identifier of the resource.
   *             Only add this for `resource_defaults` entries as this will be used as the source when present.
   */
  protected entriesToCollectionMetadata(
    entries: NodeJS.Dict<string[]>,
    reverse: boolean,
    id?: string
  ): Record<string, CollectionMetadata> {
    const result: Record<string, CollectionMetadata> = {};
    for (const [ relation, value ] of Object.entries(entries)) {
      if (!value || value.length === 0) {
        continue;
      }
      const relationNode = DF.namedNode(relation);
      for (const source of id ? [ id ] : value) {
        const entry: CollectionMetadata = {
          relation: relationNode,
          source: DF.namedNode(source),
          reverse,
        };
        result[this.getRelationKey(entry)] = entry;
      }
    }
    return result;
  }

  /**
   * Creates a unique key based on the {@link CollectionMetadata} values.
   */
  protected getRelationKey(entry: CollectionMetadata): string {
    return `${entry.source.value}-${entry.relation.value}-${entry.reverse}`;
  }

  /**
   */
  /**
   * Removes entries that are present in both maps.
   * These are the entries that remain unchanged.
   * It is assumed that matching values have the same keys.
   */
  protected filterRelationEntries(
    record1: Record<string, CollectionMetadata> = {},
    record2: Record<string, CollectionMetadata> = {},
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
   * @param part - The identifier of the part that needs to be added to collections.
   * @param entries - {@link CollectionMetadata} objects to parse.
   * @param policyStore - {@link Store} with the relevant triples to update.
   */
  protected generatePartOfTriples(part: NamedNode, entries: CollectionMetadata[], policyStore: Store): Quad[] {
    const quads: Quad[] = [];
    for (const entry of entries) {
      const collectionIds = this.findCollectionIds(entry, policyStore);
      if (collectionIds.length === 0) {
        throw new BadRequestHttpError(`Registering resource with relation ${entry.relation.value} to ${
          entry.source.value} while there is no matching collection.`);
      }

      for (const collectionId of collectionIds) {
        quads.push(DF.quad(part, ODRL.terms.partOf, collectionId));
      }
    }
    return quads;
  }

  /**
   * Finds the identifiers of the collection(s) in the given {@link Store}
   * that match the requirements of the given {@link CollectionMetadata}.
   * @param entry - Relevant {@link CollectionMetadata}.
   * @param data - {@link Store} in which to find the matching triples.
   */
  protected findCollectionIds(entry: CollectionMetadata, data: Store): Quad_Subject[] {
    const sourceMatches = data.getSubjects(ODRL.terms.source, entry.source, null);
    if (entry.reverse) {
      const blankQuads = sourceMatches.flatMap((subject): Quad[] =>
        data.getQuads(subject, ODRL_P.terms.relation, null, null));
      const matchedBlankQuads = blankQuads.filter((quad): boolean =>
        data.has(DF.quad(quad.object as Quad_Subject, OWL.terms.inverseOf, entry.relation)));
      return matchedBlankQuads.map((quad) => quad.subject);
    } else {
      return sourceMatches.filter((subject): boolean =>
        data.has(DF.quad(subject, ODRL_P.terms.relation, entry.relation)));
    }
  }

  /**
   * Generates all the triples necessary for an asset collection based on a relation.
   * If no ID is provided for the collection, a new one will be minted.
   */
  protected generateCollectionTriples(entry: CollectionMetadata, id?: Quad_Subject): Quad[] {
    const result: Quad[] = [];
    const collectionId = id ?? DF.namedNode(`collection:${randomUUID()}`);
    result.push(DF.quad(collectionId, RDF.terms.type, ODRL.terms.AssetCollection));
    result.push(DF.quad(collectionId, ODRL.terms.source, entry.source));
    if (entry.reverse) {
      const blank = DF.blankNode();
      result.push(DF.quad(collectionId, ODRL_P.terms.relation, blank));
      result.push(DF.quad(blank, OWL.terms.inverseOf, entry.relation));
    } else {
      result.push(DF.quad(collectionId, ODRL_P.terms.relation, entry.relation));
    }
    return result;
  }
}
