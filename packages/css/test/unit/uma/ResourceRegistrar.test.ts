import { ActivityEmitter, AS } from '@solid/community-server';
import { Mocked } from 'vitest';
import { ResourceRegistrar } from '../../../src/uma/ResourceRegistrar';
import { UmaClient } from '../../../src/uma/UmaClient';
import { OwnerUtil } from '../../../src/util/OwnerUtil';

describe('ResourceRegistrar', (): void => {
  const target = { path: 'http://example.com/foo' };
  const owners = [ 'owner1', 'owner2' ];
  const issuer = 'issuer';
  let emitter: Mocked<ActivityEmitter>;
  let ownerUtil: Mocked<OwnerUtil>;
  let umaClient: Mocked<UmaClient>;
  let registrar: ResourceRegistrar;

  beforeEach(async(): Promise<void> => {
    emitter = {
      on: vi.fn(),
    } satisfies Partial<ActivityEmitter> as any;

    ownerUtil = {
      findOwners: vi.fn().mockResolvedValue(owners),
      findIssuer: vi.fn().mockResolvedValue(issuer),
    } satisfies Partial<OwnerUtil> as any;

    umaClient = {
      registerResource: vi.fn().mockResolvedValue(''),
      deleteResource: vi.fn().mockResolvedValue(''),
    } satisfies Partial<UmaClient> as any;

    registrar = new ResourceRegistrar(emitter, ownerUtil, umaClient);
  });

  it('registers resources on create events.', async(): Promise<void> => {
    expect(emitter.on.mock.calls[0][0]).toBe(AS.Create);
    const createFn = emitter.on.mock.calls[0][1];
    await expect(createFn(target, null as any)).resolves.toBeUndefined();
    expect(ownerUtil.findOwners).toHaveBeenCalledTimes(1);
    expect(ownerUtil.findOwners).toHaveBeenLastCalledWith(target);
    expect(ownerUtil.findIssuer).toHaveBeenCalledTimes(2);
    expect(ownerUtil.findIssuer).toHaveBeenNthCalledWith(1, 'owner1');
    expect(ownerUtil.findIssuer).toHaveBeenNthCalledWith(2, 'owner2');
    expect(umaClient.registerResource).toHaveBeenCalledTimes(2);
    expect(umaClient.registerResource).toHaveBeenNthCalledWith(1, target, 'issuer');
    expect(umaClient.registerResource).toHaveBeenNthCalledWith(2, target, 'issuer');
  });

  it('catches the error if something goes wrong registering.', async(): Promise<void> => {
    umaClient.registerResource.mockRejectedValueOnce(new Error('bad data'));
    expect(emitter.on.mock.calls[0][0]).toBe(AS.Create);
    const createFn = emitter.on.mock.calls[0][1];
    await expect(createFn(target, null as any)).resolves.toBeUndefined();
  });

  it('deletes resources on delete events.', async(): Promise<void> => {
    expect(emitter.on.mock.calls[1][0]).toBe(AS.Delete);
    const createFn = emitter.on.mock.calls[1][1];
    await expect(createFn(target, null as any)).resolves.toBeUndefined();
    expect(ownerUtil.findOwners).toHaveBeenCalledTimes(1);
    expect(ownerUtil.findOwners).toHaveBeenLastCalledWith(target);
    expect(ownerUtil.findIssuer).toHaveBeenCalledTimes(2);
    expect(ownerUtil.findIssuer).toHaveBeenNthCalledWith(1, 'owner1');
    expect(ownerUtil.findIssuer).toHaveBeenNthCalledWith(2, 'owner2');
    expect(umaClient.deleteResource).toHaveBeenCalledTimes(2);
    expect(umaClient.deleteResource).toHaveBeenNthCalledWith(1, target, 'issuer');
    expect(umaClient.deleteResource).toHaveBeenNthCalledWith(2, target, 'issuer');
  });

  it('catches the error if something goes wrong deleting.', async(): Promise<void> => {
    umaClient.deleteResource.mockRejectedValueOnce(new Error('bad data'));
    expect(emitter.on.mock.calls[1][0]).toBe(AS.Delete);
    const createFn = emitter.on.mock.calls[1][1];
    await expect(createFn(target, null as any)).resolves.toBeUndefined();
  });
});
