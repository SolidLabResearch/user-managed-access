import { AccessMode, IdentifierSetMultiMap } from '@solid/community-server';
import { UmaPermissionReader } from './UmaPermissionReader';

describe('A UmaPermissionReader', () => {
  const permissionReader = new UmaPermissionReader();

  const resource = { path: 'https://example.org/123' };
  const resourceAlt = { path: 'https://example.org/456' };
  const webId = 'https://example.org/alice';
  const modes = new Set(['read', 'write', 'append', 'create', 'delete']);


  test('should return permissions for UMA token if resources match', async () => {
    const permissionSet = await permissionReader.handle({
      requestedModes: new IdentifierSetMultiMap<AccessMode>().set(resource, new Set()),
      credentials: { ticket: { resource, webId, modes } },
    });
    expect(permissionSet.get(resource)).toBeTruthy();
    expect(permissionSet.get(resource)?.read).toBeTruthy();
    expect(permissionSet.get(resource)?.append).toBeTruthy();
    expect(permissionSet.get(resource)?.create).toBeTruthy();
    expect(permissionSet.get(resource)?.delete).toBeTruthy();
    expect(permissionSet.get(resource)?.write).toBeTruthy();
  });

  test('should return no permissions for UMA token if resources match but permissions are empty', async () => {
    const permissionSet = await permissionReader.handle({
      requestedModes: new IdentifierSetMultiMap<AccessMode>().set(resource, new Set()),
      credentials: { ticket: { resource, webId, modes: new Set() } },
    });
    expect(permissionSet.get(resource)).toBeTruthy();
    expect(permissionSet.get(resource)?.read).toBeFalsy();
    expect(permissionSet.get(resource)?.append).toBeFalsy();
    expect(permissionSet.get(resource)?.create).toBeFalsy();
    expect(permissionSet.get(resource)?.delete).toBeFalsy();
    expect(permissionSet.get(resource)?.write).toBeFalsy();
  });

  test('should not return permissions for UMA token if resources mismatch', async () => {
    const permissionSet = await permissionReader.handle({
      requestedModes: new IdentifierSetMultiMap<AccessMode>().set(resource, new Set()),
      credentials: { ticket: { resource, webId, modes } },
    });
    expect(permissionSet.get(resource)).toBeUndefined();
  });
});
