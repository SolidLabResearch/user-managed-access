import { IdentifierMap, PermissionReaderInput } from '@solid/community-server';
import { UmaPermissionReader } from '../../../src/authorization/UmaPermissionReader';
import { UmaClaims } from '../../../src/uma/UmaClient';

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
    expect(result.get({ path: 'id1' })).toEqual({ read: true, write: true });
    expect(result.get({ path: 'id2' })).toEqual({ create: true });
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
      [ { path: 'id1' }, { read: true, write: true } ],
      [ { path: 'id2' }, { create: true } ],
    ]));
  });

  it('does not allow permission sets with invalid time restrictions.', async(): Promise<void> => {
    rpt.permissions = [
      { resource_id: 'id1', resource_scopes: [ 'urn:example:css:modes:read', 'urn:example:css:modes:write' ]},
      { resource_id: 'id2', resource_scopes: [ 'urn:example:css:modes:create' ]},
    ];

    rpt.permissions[0].iat = Date.now()/1000 + 10;
    await expect(reader.handle(input)).resolves.toEqual(new IdentifierMap([
      [ { path: 'id1' }, { read: false, write: false } ],
      [ { path: 'id2' }, { create: true } ],
    ]));
    delete rpt.permissions[0].iat;

    rpt.permissions[0].exp = Date.now()/1000 - 10;
    await expect(reader.handle(input)).resolves.toEqual(new IdentifierMap([
      [ { path: 'id1' }, { read: false, write: false } ],
      [ { path: 'id2' }, { create: true } ],
    ]));
    delete rpt.permissions[0].exp;

    rpt.permissions[0].nbf = Date.now()/1000 + 10;
    await expect(reader.handle(input)).resolves.toEqual(new IdentifierMap([
      [ { path: 'id1' }, { read: false, write: false } ],
      [ { path: 'id2' }, { create: true } ],
    ]));
    delete rpt.permissions[0].nbf;

    rpt.iat = Date.now()/1000 - 10;
    rpt.exp = Date.now()/1000 + 10;
    rpt.nbf = Date.now()/1000 - 10;
    await expect(reader.handle(input)).resolves.toEqual(new IdentifierMap([
      [ { path: 'id1' }, { read: true, write: true } ],
      [ { path: 'id2' }, { create: true } ],
    ]));
  });
});
