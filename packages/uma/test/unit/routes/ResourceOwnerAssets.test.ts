import { ForbiddenHttpError, NotFoundHttpError, RDF } from '@solid/community-server';
import { DataFactory as DF, Store } from 'n3';
import { Mocked } from 'vitest';
import { WEBID } from '../../../src/credentials/Claims';
import { CredentialParser } from '../../../src/credentials/CredentialParser';
import { Verifier } from '../../../src/credentials/verify/Verifier';
import { ResourceOwnerAssetsRequestHandler } from '../../../src/routes/ResourceOwnerAssets';
import { UCRulesStorage } from '../../../src/ucp/storage/UCRulesStorage';
import { ODRL } from '../../../src/ucp/util/Vocabularies';
import { HttpHandlerContext } from '../../../src/util/http/models/HttpHandler';
import { Registration, RegistrationStore } from '../../../src/util/RegistrationStore';
import { ResourceOwnerAssetEventEmitter } from '../../../src/util/ResourceOwnerAssetEvents';
import { createOwnerAccessPolicy } from '../../../src/util/SystemPolicy';

describe('ResourceOwnerAssets', (): void => {
  const owner = 'https://resource-owner.example/profile#me';
  const otherOwner = 'https://other.example/profile#me';
  const baseUrl = 'https://as.example/uma';
  const credential = { token: 'token', format: 'format' };

  let registrations: Record<string, Registration>;
  let registrationStore: Mocked<RegistrationStore>;
  let policyStore: Store;
  let policies: Mocked<UCRulesStorage>;
  let credentialParser: Mocked<CredentialParser>;
  let verifier: Mocked<Verifier>;
  let assetEvents: ResourceOwnerAssetEventEmitter;
  let handler: ResourceOwnerAssetsRequestHandler;
  let input: HttpHandlerContext;

  beforeEach(async(): Promise<void> => {
    registrations = {
      missing: {
        owner,
        resourceServer: 'https://rs.example/',
        registeredAt: '2026-05-18T13:20:00Z',
        updatedAt: '2026-05-18T13:20:00Z',
        description: {
          name: 'Activity file',
          description: 'A GPX activity uploaded by Garmin',
          type: 'https://schema.org/DigitalDocument',
          icon_uri: 'https://rs.example/icons/activity.svg',
          resource_scopes: [ 'read', 'write' ],
        },
      },
      configured: {
        owner,
        resourceServer: 'https://rs.example/',
        registeredAt: '2026-05-12T09:10:00Z',
        updatedAt: '2026-05-17T11:45:00Z',
        description: {
          name: 'Training metrics',
          resource_scopes: [ 'read' ],
        },
      },
      other: {
        owner: otherOwner,
        resourceServer: 'https://rs.example/',
        registeredAt: '2026-05-19T09:10:00Z',
        updatedAt: '2026-05-19T09:10:00Z',
        description: {
          name: 'Someone else',
          resource_scopes: [ 'read' ],
        },
      },
    };

    registrationStore = {
      get: vi.fn(async(id: string): Promise<Registration | undefined> => registrations[id]),
      has: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      entries: vi.fn(async function* (): AsyncIterableIterator<[string, Registration]> {
        for (const entry of Object.entries(registrations)) {
          yield entry;
        }
      }),
    } satisfies RegistrationStore as Mocked<RegistrationStore>;

    policyStore = new Store([
      ...createOwnerAccessPolicy('missing', owner).getQuads(null, null, null, null),
      DF.quad(DF.namedNode('urn:policy:configured'), RDF.terms.type, ODRL.terms.Agreement),
      DF.quad(DF.namedNode('urn:policy:configured'), ODRL.terms.uid, DF.namedNode('urn:policy:configured')),
      DF.quad(DF.namedNode('urn:policy:configured'), ODRL.terms.permission, DF.namedNode('urn:permission:configured')),
      DF.quad(DF.namedNode('urn:permission:configured'), RDF.terms.type, ODRL.terms.Permission),
      DF.quad(DF.namedNode('urn:permission:configured'), ODRL.terms.target, DF.namedNode('configured')),
      DF.quad(DF.namedNode('urn:permission:configured'), ODRL.terms.assigner, DF.namedNode(owner)),
    ]);

    policies = {
      getStore: vi.fn().mockResolvedValue(policyStore),
      addRule: vi.fn(),
      removeData: vi.fn(),
    } satisfies Partial<UCRulesStorage> as any;

    credentialParser = {
      handleSafe: vi.fn().mockResolvedValue(credential),
    } satisfies Partial<CredentialParser> as any;

    verifier = {
      verify: vi.fn().mockResolvedValue({ [WEBID]: owner }),
    } satisfies Partial<Verifier> as any;
    assetEvents = new ResourceOwnerAssetEventEmitter();

    handler = new ResourceOwnerAssetsRequestHandler(
      registrationStore,
      policies,
      credentialParser,
      verifier,
      baseUrl,
      assetEvents,
    );
    input = {
      request: {
        url: new URL('https://as.example/uma/resource-owner/assets'),
        method: 'GET',
        headers: {},
      }
    };
  });

  it('lists only manageable assets for the authenticated owner.', async(): Promise<void> => {
    input.request.url = new URL(
      'https://as.example/uma/resource-owner/assets?include=description,scopes,policies,policy_uri'
    );

    await expect(handler.handle(input)).resolves.toEqual({
      status: 200,
      body: {
        assets: [
          {
            _id: 'missing',
            resource_server: 'https://rs.example/',
            registered_at: '2026-05-18T13:20:00Z',
            updated_at: '2026-05-18T13:20:00Z',
            is_new: true,
            description: {
              name: 'Activity file',
              description: 'A GPX activity uploaded by Garmin',
              type: 'https://schema.org/DigitalDocument',
              icon_uri: 'https://rs.example/icons/activity.svg',
              resource_scopes: [ 'read', 'write' ],
            },
            policy: {
              status: 'missing',
              policy_uri: 'https://as.example/uma/policies/assets/missing',
            },
          },
          {
            _id: 'configured',
            resource_server: 'https://rs.example/',
            registered_at: '2026-05-12T09:10:00Z',
            updated_at: '2026-05-17T11:45:00Z',
            is_new: false,
            description: {
              name: 'Training metrics',
              resource_scopes: [ 'read' ],
            },
            policy: {
              status: 'configured',
              policy_uri: 'https://as.example/uma/policies/assets/configured',
            },
          },
        ],
      },
    });
  });

  it('filters by resource server and timestamps.', async(): Promise<void> => {
    input.request.url = new URL(
      'https://as.example/uma/resource-owner/assets?resource_server=https%3A%2F%2Frs.example%2F' +
      '&new_since=2026-05-15T00:00:00Z&updated_since=2026-05-18T00:00:00Z'
    );

    await expect(handler.handle(input)).resolves.toEqual({
      status: 200,
      body: {
        assets: [
          {
            _id: 'missing',
            resource_server: 'https://rs.example/',
            registered_at: '2026-05-18T13:20:00Z',
            updated_at: '2026-05-18T13:20:00Z',
            is_new: true,
            policy: {
              status: 'missing',
              policy_uri: 'https://as.example/uma/policies/assets/missing',
            },
          },
        ],
      },
    });
  });

  it('returns full details for one owned asset.', async(): Promise<void> => {
    input.request.parameters = { id: 'configured' };

    await expect(handler.handle(input)).resolves.toEqual({
      status: 200,
      body: {
        _id: 'configured',
        resource_server: 'https://rs.example/',
        registered_at: '2026-05-12T09:10:00Z',
        updated_at: '2026-05-17T11:45:00Z',
        description: {
          name: 'Training metrics',
          resource_scopes: [ 'read' ],
        },
        policy: {
          status: 'configured',
          policy_uri: 'https://as.example/uma/policies/assets/configured',
        },
      },
    });
  });

  it('does not expose details for assets owned by another resource owner.', async(): Promise<void> => {
    input.request.parameters = { id: 'other' };
    await expect(handler.handle(input)).rejects.toThrow(ForbiddenHttpError);
  });

  it('returns 404 for unknown assets.', async(): Promise<void> => {
    input.request.parameters = { id: 'unknown' };
    await expect(handler.handle(input)).rejects.toThrow(NotFoundHttpError);
  });

  it('streams snapshots and asset updates with SSE.', async(): Promise<void> => {
    input.request.headers.accept = 'text/event-stream';
    input.request.url = new URL('https://as.example/uma/resource-owner/assets?include=description,scopes,policy_uri');

    const response = await handler.handle(input);
    expect(response.status).toBe(200);
    expect(response.headers?.['content-type']).toBe('text/event-stream');

    const stream = response.body as NodeJS.ReadableStream;
    const snapshot = await readSseEvent(stream);
    expect(snapshot).toContain('event: snapshot');
    expect(snapshot).toContain('"assets"');

    const registration: Registration = {
      owner,
      resourceServer: 'https://rs.example/',
      registeredAt: '2026-05-19T10:00:00Z',
      updatedAt: '2026-05-19T10:00:00Z',
      description: {
        name: 'New file',
        resource_scopes: [ 'read' ],
      },
    };
    registrations.new = registration;
    assetEvents.emit({ type: 'created', id: 'new', owner, registration });

    const update = await readSseEvent(stream);
    expect(update).toContain('event: asset-created');
    expect(update).toContain('"_id":"new"');
    expect(update).toContain('"policy_uri":"https://as.example/uma/policies/assets/new"');
    stream.destroy?.();
  });
});

const readSseEvent = async(stream: NodeJS.ReadableStream): Promise<string> => new Promise((resolve): void => {
  let result = '';
  const onData = (chunk: Buffer): void => {
    result += chunk.toString('utf8');
    if (result.includes('\n\n')) {
      stream.off('data', onData);
      resolve(result);
    }
  };
  stream.on('data', onData);
});
