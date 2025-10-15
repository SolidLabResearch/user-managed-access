import { ActivityEmitter, AS } from '@solid/community-server';
import { Mocked } from 'vitest';
import { ResourceRegistrar } from '../../../src/uma/ResourceRegistrar';
import { UmaClient } from '../../../src/uma/UmaClient';
import { OwnerUtil } from '../../../src/util/OwnerUtil';

describe('ResourceRegistrar', (): void => {
  const target = { path: 'http://example.com/foo' };
  const owners = [ 'owner1' ];
  const issuer = 'issuer';
  const credentials = 'credentials';
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
      findUmaSettings: vi.fn().mockResolvedValue({ issuer, credentials }),
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
    expect(ownerUtil.findUmaSettings).toHaveBeenCalledTimes(1);
    expect(ownerUtil.findUmaSettings).toHaveBeenLastCalledWith('owner1');
    expect(umaClient.registerResource).toHaveBeenCalledTimes(1);
    expect(umaClient.registerResource).toHaveBeenLastCalledWith(target, issuer, credentials);
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
    expect(ownerUtil.findUmaSettings).toHaveBeenCalledTimes(1);
    expect(ownerUtil.findUmaSettings).toHaveBeenLastCalledWith('owner1');
    expect(umaClient.deleteResource).toHaveBeenCalledTimes(1);
    expect(umaClient.deleteResource).toHaveBeenLastCalledWith(target, issuer, credentials);
  });

  it('catches the error if something goes wrong deleting.', async(): Promise<void> => {
    umaClient.deleteResource.mockRejectedValueOnce(new Error('bad data'));
    expect(emitter.on.mock.calls[1][0]).toBe(AS.Delete);
    const createFn = emitter.on.mock.calls[1][1];
    await expect(createFn(target, null as any)).resolves.toBeUndefined();
  });
});
