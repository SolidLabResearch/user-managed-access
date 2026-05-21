import { Registration } from './RegistrationStore';

export type ResourceOwnerAssetEventType = 'created' | 'updated' | 'deleted';

export type ResourceOwnerAssetEvent = {
  type: ResourceOwnerAssetEventType,
  id: string,
  owner: string,
  registration?: Registration,
};

type ResourceOwnerAssetEventListener = (event: ResourceOwnerAssetEvent) => void;

/**
 * In-process event broker for resource-owner asset discovery updates.
 */
export class ResourceOwnerAssetEventEmitter {
  protected readonly listeners: ResourceOwnerAssetEventListener[] = [];

  public subscribe(listener: ResourceOwnerAssetEventListener): () => void {
    this.listeners.push(listener);
    return (): void => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public emit(event: ResourceOwnerAssetEvent): void {
    for (const listener of [ ...this.listeners ]) {
      listener(event);
    }
  }
}
