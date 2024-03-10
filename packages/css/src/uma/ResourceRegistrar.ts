import type { ResourceIdentifier, MonitoringStore, KeyValueStorage } from '@solid/community-server';
import { AS, getLoggerFor, StaticHandler } from '@solid/community-server';
import { OwnerUtil } from '../util/OwnerUtil';
import { ResourceDescription } from '@solidlab/uma';
import type { UmaClient } from '../uma/UmaClient';

export class ResourceRegistrar extends StaticHandler {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    protected store: MonitoringStore,
    protected umaIdStore: KeyValueStorage<string, string>,
    protected ownerUtil: OwnerUtil,
    protected umaClient: UmaClient,
  ) {
    super();

    store.on(AS.Create, async (resource: ResourceIdentifier): Promise<void> => {
      const owners = await this.ownerUtil.findOwners(resource).catch(() => []);
      for (const owner of owners) this.createResource(resource, owner);
    });

    store.on(AS.Delete, async (resource: ResourceIdentifier): Promise<void> => {
      const owners = await this.ownerUtil.findOwners(resource).catch(() => []);
      for (const owner of owners) this.deleteResource(resource, owner);
    });
  }

  protected async createResource(resource: ResourceIdentifier, owner: string): Promise<void> {
    const issuer = await this.ownerUtil.findIssuer(owner);

    if (!issuer) throw new Error(`Could not find UMA AS for resource owner ${owner}`);

    const { resource_registration_endpoint: endpoint } = await this.umaClient.fetchUmaConfig(issuer);

    const description: ResourceDescription = {
      resource_scopes: [
        'urn:example:css:modes:read',
        'urn:example:css:modes:append',
        'urn:example:css:modes:create',
        'urn:example:css:modes:delete',
        'urn:example:css:modes:write',
      ]
    };

    this.logger.info(`Creating resource registration for <${resource.path}> at <${endpoint}>`);

    const request = {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(description),
    };

    // do not await - registration happens in background to cope with errors etc.
    this.umaClient.signedFetch(endpoint, request).then(async resp => {
      if (resp.status !== 201) {
        throw new Error (`Resource registration request failed. ${await resp.text()}`);
      }

      const { _id: umaId } = await resp.json();
      
      if (!umaId || typeof umaId !== 'string') {
        throw new Error ('Unexpected response from UMA server; no UMA id received.');
      }
      
      this.umaIdStore.set(resource.path, umaId);
    }).catch(error => {
      // TODO: Do something useful on error
      this.logger.warn(
        `Something went wrong during UMA resource registration to create ${resource.path}: ${(error as Error).message}`
      );
    });
  }

  protected async deleteResource(resource: ResourceIdentifier, owner: string): Promise<void> {
    const issuer = await this.ownerUtil.findIssuer(owner);

    if (!issuer) throw new Error(`Could not find UMA AS for resource owner ${owner}`);
    
    const { resource_registration_endpoint: endpoint } = await this.umaClient.fetchUmaConfig(issuer);

    this.logger.info(`Deleting resource registration for <${resource.path}> at <${endpoint}>`);

    const umaId = await this.umaIdStore.get(resource.path);
    const url = `${endpoint}/${umaId}`;

    const request = {
      url,
      method: 'DELETE',
      headers: {}
    };

    // do not await - registration happens in background to cope with errors etc.
    this.umaClient.signedFetch(endpoint, request).then(async _resp => {
      if (!umaId) throw new Error('Trying to delete unknown/unregistered resource; no UMA id found.');

      await this.umaClient.signedFetch(url, request);
    }).catch(error => {
      // TODO: Do something useful on error
      this.logger.warn(
        `Something went wrong during UMA resource registration to delete ${resource.path}: ${(error as Error).message}`
      );
    });
  }
}
