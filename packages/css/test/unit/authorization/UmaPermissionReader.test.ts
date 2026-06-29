import { IdentifierMap, KeyValueStorage, PermissionReaderInput } from '@solid/community-server';
import { PERMISSIONS } from '@solidlab/policy-engine';
import { Mocked } from 'vitest';
import { UmaPermissionReader } from '../../../src/authorization/UmaPermissionReader';
import { UmaClaims } from '../../../src/uma/UmaClient';
import { OwnerUtil } from '../../../src/util/OwnerUtil';

describe('UmaPermissionReader', (): void => {
  let rpt: UmaClaims = {};
  const input: PermissionReaderInput = { credentials: { uma: { rpt }}} as any;

  const reader = new UmaPermissionReader();

  it('resolves if the claims are empty.', async(): Promise<void> => {
    await expect(reader.handle(input)).resolves.toEqual(new IdentifierMap());
  });

  it('returns the permissions in the token.', async(): Promise<void> => {
    rpt.permissions = [
      { resource_id: 'id1', resource_scopes: [ 'urn:example:css:modes:read', 'urn:example:css:modes:write' ]},
      { resource_id: 'id2', resource_scopes: [ 'urn:example:css:modes:create' ]},
    ];
    const result = await reader.handle(input);
    expect([ ...result.keys() ]).toEqual([ { path: 'id1' }, { path: 'id2' } ]);
    expect(result.get({ path: 'id1' })).toEqual({ [PERMISSIONS.Read]: true, [PERMISSIONS.Modify]: true });
    expect(result.get({ path: 'id2' })).toEqual({ [PERMISSIONS.Create]: true });
  });

  it('maps UMA resource ids back to CSS resource paths.', async(): Promise<void> => {
    const umaIdStore = {
      entries: vi.fn(async function*(): AsyncIterableIterator<[string, string]> {
        yield [ '/foo', 'uuid-1' ];
        yield [ '/bar', 'uuid-2' ];
      }),
    } satisfies Partial<KeyValueStorage<string, string>> as Mocked<KeyValueStorage<string, string>>;
    const mappingReader = new UmaPermissionReader(undefined, umaIdStore);

    rpt.permissions = [
      { resource_id: 'uuid-1', resource_scopes: [ 'urn:example:css:modes:read' ]},
      { resource_id: 'uuid-2', resource_scopes: [ 'urn:example:css:modes:create' ]},
    ];

    const result = await mappingReader.handle(input);
    expect([ ...result.keys() ]).toEqual([ { path: '/foo' }, { path: '/bar' } ]);
    expect(result.get({ path: '/foo' })).toEqual({ [PERMISSIONS.Read]: true });
    expect(result.get({ path: '/bar' })).toEqual({ [PERMISSIONS.Create]: true });
  });

  it('returns an empty result if the token has invalid time restrictions.', async(): Promise<void> => {
    rpt.permissions = [
      { resource_id: 'id1', resource_scopes: [ 'urn:example:css:modes:read', 'urn:example:css:modes:write' ]},
      { resource_id: 'id2', resource_scopes: [ 'urn:example:css:modes:create' ]},
    ];

    rpt.iat = Date.now()/1000 + 10;
    await expect(reader.handle(input)).resolves.toEqual(new IdentifierMap());
    delete rpt.iat;

    rpt.exp = Date.now()/1000 - 10;
    await expect(reader.handle(input)).resolves.toEqual(new IdentifierMap());
    delete rpt.exp;

    rpt.nbf = Date.now()/1000 + 10;
    await expect(reader.handle(input)).resolves.toEqual(new IdentifierMap());
    delete rpt.nbf;

    rpt.iat = Date.now()/1000 - 10;
    rpt.exp = Date.now()/1000 + 10;
    rpt.nbf = Date.now()/1000 - 10;
    await expect(reader.handle(input)).resolves.toEqual(new IdentifierMap([
      [ { path: 'id1' }, { [PERMISSIONS.Read]: true, [PERMISSIONS.Modify]: true } ],
      [ { path: 'id2' }, { [PERMISSIONS.Create]: true } ],
    ]));
  });

  it('does not allow permission sets with invalid time restrictions.', async(): Promise<void> => {
    rpt.permissions = [
      { resource_id: 'id1', resource_scopes: [ 'urn:example:css:modes:read', 'urn:example:css:modes:write' ]},
      { resource_id: 'id2', resource_scopes: [ 'urn:example:css:modes:create' ]},
    ];

    rpt.permissions[0].iat = Date.now()/1000 + 10;
    await expect(reader.handle(input)).resolves.toEqual(new IdentifierMap([
      [ { path: 'id1' }, { [PERMISSIONS.Read]: false, [PERMISSIONS.Modify]: false } ],
      [ { path: 'id2' }, { [PERMISSIONS.Create]: true } ],
    ]));
    delete rpt.permissions[0].iat;

    rpt.permissions[0].exp = Date.now()/1000 - 10;
    await expect(reader.handle(input)).resolves.toEqual(new IdentifierMap([
      [ { path: 'id1' }, { [PERMISSIONS.Read]: false, [PERMISSIONS.Modify]: false } ],
      [ { path: 'id2' }, { [PERMISSIONS.Create]: true } ],
    ]));
    delete rpt.permissions[0].exp;

    rpt.permissions[0].nbf = Date.now()/1000 + 10;
    await expect(reader.handle(input)).resolves.toEqual(new IdentifierMap([
      [ { path: 'id1' }, { [PERMISSIONS.Read]: false, [PERMISSIONS.Modify]: false } ],
      [ { path: 'id2' }, { [PERMISSIONS.Create]: true } ],
    ]));
    delete rpt.permissions[0].nbf;

    rpt.iat = Date.now()/1000 - 10;
    rpt.exp = Date.now()/1000 + 10;
    rpt.nbf = Date.now()/1000 - 10;
    await expect(reader.handle(input)).resolves.toEqual(new IdentifierMap([
      [ { path: 'id1' }, { [PERMISSIONS.Read]: true, [PERMISSIONS.Modify]: true } ],
      [ { path: 'id2' }, { [PERMISSIONS.Create]: true } ],
    ]));
  });

  it('only accepts permissions from the resource owner\'s UMA issuer.', async(): Promise<void> => {
    const ownerUtil = {
      findOwners: vi.fn().mockResolvedValue([ 'owner' ]),
      findUmaSettings: vi.fn().mockResolvedValue({ issuer: 'issuer' }),
    } satisfies Partial<OwnerUtil> as any;
    const validatingReader = new UmaPermissionReader(ownerUtil);

    rpt.iss = 'issuer';
    rpt.permissions = [
      { resource_id: 'id1', resource_scopes: [ 'urn:example:css:modes:read' ]},
    ];

    await expect(validatingReader.handle(input)).resolves.toEqual(new IdentifierMap([
      [ { path: 'id1' }, { [PERMISSIONS.Read]: true } ],
    ]));

    rpt.iss = 'other';
    await expect(validatingReader.handle(input)).resolves.toEqual(new IdentifierMap());
  });
});
