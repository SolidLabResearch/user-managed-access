import {
  BadRequestHttpError,
  ForbiddenHttpError,
  joinUrl,
  MethodNotAllowedHttpError,
  NotFoundHttpError,
  RDF,
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { DataFactory as DF, Store } from 'n3';
import { PassThrough } from 'node:stream';
import { WEBID } from '../credentials/Claims';
import { CredentialParser } from '../credentials/CredentialParser';
import { Verifier } from '../credentials/verify/Verifier';
import { UCRulesStorage } from '../ucp/storage/UCRulesStorage';
import { ODRL } from '../ucp/util/Vocabularies';
import {
  HttpHandler,
  HttpHandlerContext,
  HttpHandlerRequest,
  HttpHandlerResponse
} from '../util/http/models/HttpHandler';
import { Registration, RegistrationStore } from '../util/RegistrationStore';
import { ResourceOwnerAssetEvent, ResourceOwnerAssetEventEmitter } from '../util/ResourceOwnerAssetEvents';
import { isOwnerAccessPolicyId, isSystemPolicy } from '../util/SystemPolicy';
import { ResourceDescription } from '../views/ResourceDescription';

type PolicyStatus = 'missing' | 'configured';

type AssetPolicy = {
  status?: PolicyStatus,
  policy_uri?: string,
};

type AssetDescription = Omit<ResourceDescription, 'resource_scopes'> & {
  resource_scopes?: string[],
};

type ResourceOwnerAsset = {
  _id: string,
  resource_server?: string,
  registered_at?: string,
  updated_at?: string,
  is_new?: boolean,
  description?: AssetDescription,
  policy?: AssetPolicy,
};

const VALID_INCLUDES = new Set([ 'description', 'scopes', 'policies', 'policy_uri' ]);
const TEXT_EVENT_STREAM = 'text/event-stream';

/**
 * Lists registered assets for the authenticated resource owner.
 */
export class ResourceOwnerAssetsRequestHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    protected readonly registrationStore: RegistrationStore,
    protected readonly policies: UCRulesStorage,
    protected readonly credentialParser: CredentialParser,
    protected readonly verifier: Verifier,
    protected readonly baseUrl: string,
    protected readonly assetEvents?: ResourceOwnerAssetEventEmitter,
  ) {
    super();
  }

  public async handle({ request }: HttpHandlerContext): Promise<HttpHandlerResponse> {
    const owner = await this.authenticate(request);

    switch (request.method) {
      case 'GET':
        return typeof request.parameters?.id === 'string' ?
          this.handleSingleGet(request, owner) :
          this.handleGet(request, owner);
      default:
        throw new MethodNotAllowedHttpError([ request.method ]);
    }
  }

  protected async authenticate(request: HttpHandlerRequest): Promise<string> {
    const credential = await this.credentialParser.handleSafe(request);
    const claims = await this.verifier.verify(credential);
    const userId = claims[WEBID];
    if (typeof userId !== 'string') {
      throw new ForbiddenHttpError(`Missing claim ${WEBID}.`);
    }
    return userId;
  }

  protected async handleGet(request: HttpHandlerRequest, owner: string): Promise<HttpHandlerResponse> {
    const includes = this.parseIncludes(request.url.searchParams.get('include'));
    const resourceServer = request.url.searchParams.get('resource_server') ?? undefined;
    const newSince = this.parseTimestamp(request.url.searchParams.get('new_since'), 'new_since');
    const updatedSince = this.parseTimestamp(request.url.searchParams.get('updated_since'), 'updated_since');
    if (this.wantsSse(request)) {
      return this.handleListSse(owner, includes, resourceServer, newSince, updatedSince);
    }

    const policyStore = await this.policies.getStore();
    const assets: ResourceOwnerAsset[] = [];

    for await (const [ id, registration ] of this.registrationStore.entries()) {
      if (!this.matchesListFilters(registration, owner, resourceServer, newSince, updatedSince)) {
        continue;
      }
      assets.push(this.toAsset(id, registration, policyStore, includes, true));
    }

    assets.sort((left, right) => (right.registered_at ?? '').localeCompare(left.registered_at ?? ''));
    return { status: 200, body: { assets }};
  }

  protected async handleSingleGet(request: HttpHandlerRequest, owner: string): Promise<HttpHandlerResponse> {
    const id = request.parameters!.id;
    const registration = await this.registrationStore.get(id);
    if (!registration) {
      throw new NotFoundHttpError('Asset not found.');
    }
    if (registration.owner !== owner) {
      throw new ForbiddenHttpError(`${owner} is not allowed to manage policies for this asset.`);
    }

    const includes = new Set([ 'description', 'scopes', 'policies', 'policy_uri' ]);
    if (this.wantsSse(request)) {
      return this.handleSingleSse(id, owner, includes);
    }

    return {
      status: 200,
      body: this.toAsset(id, registration, await this.policies.getStore(), includes, false),
    };
  }

  protected handleListSse(
    owner: string,
    includes: Set<string>,
    resourceServer?: string,
    newSince?: number,
    updatedSince?: number,
  ): HttpHandlerResponse {
    const stream = this.createSseStream();
    void this.writeListSnapshot(stream, owner, includes, resourceServer, newSince, updatedSince)
      .catch((error: unknown) => this.writeSseError(stream, error));

    const unsubscribe = this.assetEvents?.subscribe((event): void => {
      if (event.owner !== owner) {
        return;
      }
      if (event.type === 'deleted') {
        if (!event.registration ||
          !this.matchesListFilters(event.registration, owner, resourceServer, newSince, updatedSince)) {
          return;
        }
        this.writeSseEvent(stream, 'asset-deleted', {
          _id: event.id,
          resource_server: event.registration.resourceServer,
        });
        return;
      }

      void this.writeListAssetEvent(stream, event, owner, includes, resourceServer, newSince, updatedSince)
        .catch((error: unknown) => this.writeSseError(stream, error));
    });
    stream.on('close', () => unsubscribe?.());

    return this.toSseResponse(stream);
  }

  protected handleSingleSse(id: string, owner: string, includes: Set<string>): HttpHandlerResponse {
    const stream = this.createSseStream();
    void this.writeSingleSnapshot(stream, id, owner, includes)
      .catch((error: unknown) => this.writeSseError(stream, error));

    const unsubscribe = this.assetEvents?.subscribe((event): void => {
      if (event.owner !== owner || event.id !== id) {
        return;
      }
      if (event.type === 'deleted') {
        this.writeSseEvent(stream, 'asset-deleted', { _id: event.id });
        return;
      }
      void this.writeSingleAssetEvent(stream, event, includes)
        .catch((error: unknown) => this.writeSseError(stream, error));
    });
    stream.on('close', () => unsubscribe?.());

    return this.toSseResponse(stream);
  }

  protected async writeListSnapshot(
    stream: PassThrough,
    owner: string,
    includes: Set<string>,
    resourceServer?: string,
    newSince?: number,
    updatedSince?: number,
  ): Promise<void> {
    const policyStore = await this.policies.getStore();
    const assets: ResourceOwnerAsset[] = [];
    for await (const [ id, registration ] of this.registrationStore.entries()) {
      if (this.matchesListFilters(registration, owner, resourceServer, newSince, updatedSince)) {
        assets.push(this.toAsset(id, registration, policyStore, includes, true));
      }
    }
    assets.sort((left, right) => (right.registered_at ?? '').localeCompare(left.registered_at ?? ''));
    this.writeSseEvent(stream, 'snapshot', { assets });
  }

  protected async writeSingleSnapshot(
    stream: PassThrough,
    id: string,
    owner: string,
    includes: Set<string>,
  ): Promise<void> {
    const registration = await this.registrationStore.get(id);
    if (registration?.owner === owner) {
      this.writeSseEvent(stream, 'snapshot', this.toAsset(id, registration, await this.policies.getStore(), includes, false));
    }
  }

  protected async writeListAssetEvent(
    stream: PassThrough,
    event: ResourceOwnerAssetEvent,
    owner: string,
    includes: Set<string>,
    resourceServer?: string,
    newSince?: number,
    updatedSince?: number,
  ): Promise<void> {
    const registration = event.registration ?? await this.registrationStore.get(event.id);
    if (!registration || !this.matchesListFilters(registration, owner, resourceServer, newSince, updatedSince)) {
      return;
    }
    this.writeSseEvent(
      stream,
      event.type === 'created' ? 'asset-created' : 'asset-updated',
      this.toAsset(event.id, registration, await this.policies.getStore(), includes, true),
    );
  }

  protected async writeSingleAssetEvent(
    stream: PassThrough,
    event: ResourceOwnerAssetEvent,
    includes: Set<string>,
  ): Promise<void> {
    const registration = event.registration ?? await this.registrationStore.get(event.id);
    if (registration) {
      this.writeSseEvent(
        stream,
        event.type === 'created' ? 'asset-created' : 'asset-updated',
        this.toAsset(event.id, registration, await this.policies.getStore(), includes, false),
      );
    }
  }

  protected matchesListFilters(
    registration: Registration,
    owner: string,
    resourceServer?: string,
    newSince?: number,
    updatedSince?: number,
  ): boolean {
    if (registration.owner !== owner) {
      return false;
    }
    if (resourceServer && registration.resourceServer !== resourceServer) {
      return false;
    }
    if (newSince !== undefined && this.toTime(registration.registeredAt) <= newSince) {
      return false;
    }
    if (updatedSince !== undefined && this.toTime(registration.updatedAt) <= updatedSince) {
      return false;
    }
    return true;
  }

  protected toAsset(
    id: string,
    registration: Registration,
    policyStore: Store,
    includes: Set<string>,
    list: boolean,
  ): ResourceOwnerAsset {
    const policyStatus = this.getPolicyStatus(id, registration.owner, policyStore);
    const asset: ResourceOwnerAsset = {
      _id: id,
      resource_server: registration.resourceServer,
      registered_at: registration.registeredAt,
      updated_at: registration.updatedAt,
      ...list && { is_new: policyStatus === 'missing' },
    };

    if (includes.has('description') || includes.has('scopes')) {
      asset.description = this.toDescription(
        registration.description,
        includes.has('description'),
        includes.has('scopes'),
      );
    }
    if (includes.has('policies') || includes.has('policy_uri')) {
      asset.policy = {
        status: policyStatus,
        ...includes.has('policy_uri') && { policy_uri: this.getPolicyUri(id) },
      };
    }

    return asset;
  }

  protected toDescription(description: ResourceDescription, includeDescription: boolean, includeScopes: boolean):
  AssetDescription {
    const { resource_scopes, ...descriptionFields } = description;
    return {
      ...includeDescription && descriptionFields,
      ...includeScopes && { resource_scopes },
    };
  }

  protected getPolicyStatus(id: string, owner: string, store: Store): PolicyStatus {
    const targets = [
      DF.namedNode(id),
      ...store.getObjects(DF.namedNode(id), ODRL.terms.partOf, null),
    ];

    for (const target of targets) {
      const permissions = store.getSubjects(ODRL.terms.target, target, null)
        .filter((permission) => store.has(DF.quad(permission, ODRL.terms.assigner, DF.namedNode(owner))));
      for (const permission of permissions) {
        const policies = store.getSubjects(ODRL.terms.permission, permission, null)
          .filter((policy) =>
            (store.has(DF.quad(policy, RDF.terms.type, ODRL.terms.Agreement)) ||
              store.has(DF.quad(policy, RDF.terms.type, ODRL.terms.Set))) &&
            !isSystemPolicy(store, policy.value) &&
            !isOwnerAccessPolicyId(policy.value));
        if (policies.length > 0) {
          return 'configured';
        }
      }
    }
    return 'missing';
  }

  protected getPolicyUri(id: string): string {
    return joinUrl(this.baseUrl, `policies/assets/${encodeURIComponent(id)}`);
  }

  protected wantsSse(request: HttpHandlerRequest): boolean {
    return request.url.searchParams.get('watch') === 'true' ||
      request.url.searchParams.get('sse') === 'true' ||
      request.headers.accept?.toLowerCase().includes(TEXT_EVENT_STREAM) === true;
  }

  protected createSseStream(): PassThrough {
    const stream = new PassThrough();
    const heartbeat = setInterval(() => {
      stream.write(': keep-alive\n\n');
    }, 30_000);
    stream.on('close', () => clearInterval(heartbeat));
    return stream;
  }

  protected toSseResponse(stream: PassThrough): HttpHandlerResponse {
    return {
      status: 200,
      headers: {
        'content-type': TEXT_EVENT_STREAM,
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
      body: stream,
    };
  }

  protected writeSseEvent(stream: PassThrough, event: string, data: unknown): void {
    if (stream.destroyed) {
      return;
    }
    stream.write(`event: ${event}\n`);
    stream.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  protected writeSseError(stream: PassThrough, error: unknown): void {
    this.writeSseEvent(stream, 'error', { message: error instanceof Error ? error.message : 'Unknown error' });
  }

  protected parseIncludes(value: string | null): Set<string> {
    const includes = new Set<string>();
    if (!value) {
      includes.add('policy_uri');
      return includes;
    }

    for (const entry of value.split(',').map((include) => include.trim()).filter(Boolean)) {
      if (!VALID_INCLUDES.has(entry)) {
        throw new BadRequestHttpError(`Unknown include value: ${entry}`);
      }
      includes.add(entry);
    }
    return includes;
  }

  protected parseTimestamp(value: string | null, name: string): number | undefined {
    if (!value) {
      return undefined;
    }
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
      throw new BadRequestHttpError(`Invalid ${name} timestamp.`);
    }
    return timestamp;
  }

  protected toTime(value?: string): number {
    return value ? Date.parse(value) : Number.NEGATIVE_INFINITY;
  }
}
