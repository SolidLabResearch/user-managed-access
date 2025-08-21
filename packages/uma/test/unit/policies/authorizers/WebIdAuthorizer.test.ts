import { WEBID } from '../../../../src/credentials/Claims';
import { WebIdAuthorizer } from '../../../../src/policies/authorizers/WebIdAuthorizer';
import { Permission } from '../../../../src/views/Permission';

describe('WebIdAuthorizer', (): void => {
  const webIds = [
    'http://example.com/foo1',
    'http://example.com/foo2',
  ];

  let authorizer = new WebIdAuthorizer(webIds);

  it('returns empty permissions if there is no WebID match.', async(): Promise<void> => {
    await expect(authorizer.permissions({})).resolves.toEqual([]);
    await expect(authorizer.permissions({ [WEBID]: 'unknown' })).resolves.toEqual([]);
  });

  it('returns full permissions if there is a matching WebID.', async(): Promise<void> => {
    const query: Partial<Permission>[] = [
      { resource_id: 'id1', resource_scopes: [ 'scope1' ]},
      { resource_id: 'id2' },
      { resource_scopes: [ 'scope3' ]},
    ];
    await expect(authorizer.permissions({ [WEBID]: webIds[0] }, query)).resolves.toEqual([
      { resource_id: 'id1', resource_scopes: [ 'scope1' ]},
      { resource_id: 'id2', resource_scopes: [ 'urn:solidlab:uma:scopes:any' ]},
      { resource_id: 'urn:solidlab:uma:resources:any', resource_scopes: [ 'scope3' ]},
    ]);
  });

  it('returns an empty requirements result if there a query without WebID', async(): Promise<void> => {
    await expect(authorizer.credentials([], {})).resolves.toEqual([]);
  });

  it('requires a WebID match.', async(): Promise<void> => {
    const result = await authorizer.credentials([], { [WEBID]: vi.fn() });
    expect(result).toHaveLength(1);
    expect(result[0][WEBID]).toBeDefined();
    await expect(result[0][WEBID]!(webIds[0])).resolves.toBe(true);
    await expect(result[0][WEBID]!(webIds[1])).resolves.toBe(true);
    await expect(result[0][WEBID]!('wrong')).resolves.toBe(false);
  });
});
