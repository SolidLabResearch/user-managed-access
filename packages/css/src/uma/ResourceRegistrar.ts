import type { ResourceIdentifier, MonitoringStore, KeyValueStorage } from '@solid/community-server';
import { AS, getLoggerFor, StaticHandler } from '@solid/community-server';
import { OwnerUtil } from '../util/OwnerUtil';
import { fetchUmaConfig } from './util/UmaConfigFetcher.js';
import { ResourceDescription } from '@solidlab/uma';

export class ResourceRegistrar extends StaticHandler {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    protected store: MonitoringStore,
    protected umaIdStore: KeyValueStorage<string, string>,
    protected ownerUtil: OwnerUtil,
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
    const pat = await this.ownerUtil.retrievePat(owner);

    if (!issuer) throw new Error(`Could not find UMA AS for resource owner ${owner}`);
    if (!pat) throw new Error(`Could not find PAT for resource owner ${owner}`);

    const { resource_registration_endpoint: endpoint } = await fetchUmaConfig(issuer);

    const description: ResourceDescription = { resource_scopes: [ 'CRUD' ] };

    this.logger.info(`Creating resource registration for <${resource.path}> at <${endpoint}>`);

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(description),
      });

      if (resp.status !== 201) {
        throw new Error (`Resource registration request failed. ${await resp.text()}`);
      }

      const { _id: umaId } = await resp.json();
      
      if (!umaId || typeof umaId !== 'string') {
        throw new Error ('Unexpected response from UMA server; no UMA id received.');
      }
      
      this.umaIdStore.set(resource.path, umaId);
    } catch (error) {
      // TODO: Do something useful on error
      this.logger.warn(
        `Something went wrong during UMA resource registration to create ${resource.path}: ${(error as Error).message}`
      );
    }
  }

  protected async deleteResource(resource: ResourceIdentifier, owner: string): Promise<void> {
    const issuer = await this.ownerUtil.findIssuer(owner);
    const pat = await this.ownerUtil.retrievePat(owner);

    if (!issuer) throw new Error(`Could not find UMA AS for resource owner ${owner}`);
    if (!pat) throw new Error(`Could not find PAT for resource owner ${owner}`);
    
    const { resource_registration_endpoint: endpoint } = await fetchUmaConfig(issuer);

    this.logger.info(`Deleting resource registration for <${resource.path}> at <${endpoint}>`);

    const umaId = await this.umaIdStore.get(resource.path);

    try {
      if (!umaId) throw new Error('Trying to delete unknown/unregistered resource; no UMA id found.');

      const resp = await fetch(`${endpoint}/${umaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${pat}`,
        }
      });
    } catch (error) {
      // TODO: Do something useful on error
      this.logger.warn(
        `Something went wrong during UMA resource registration to delete ${resource.path}: ${(error as Error).message}`
      );
    }
  }
}
