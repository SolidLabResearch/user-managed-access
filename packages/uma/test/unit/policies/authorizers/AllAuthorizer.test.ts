import { AllAuthorizer } from '../../../../src/policies/authorizers/AllAuthorizer';
import { Permission } from '../../../../src/views/Permission';

describe('AllAuthorizer', (): void => {
  const authorizer = new AllAuthorizer();

  it('allows all scopes for all resources.', async(): Promise<void> => {
    await expect(authorizer.permissions({})).resolves
      .toEqual([{ resource_id: 'urn:solidlab:uma:resources:any', resource_scopes: [ 'urn:solidlab:uma:scopes:any' ] }]);
  });

  it('allows all query permissions/scopes if there is one.', async(): Promise<void> => {
    const query: Partial<Permission>[] = [
      { resource_id: 'id1', resource_scopes: [ 'scope1' ]},
      { resource_id: 'id2' },
      { resource_scopes: [ 'scope3' ]},
    ];
    await expect(authorizer.permissions({}, query)).resolves.toEqual([
      { resource_id: 'id1', resource_scopes: [ 'scope1' ]},
      { resource_id: 'id2', resource_scopes: [ 'urn:solidlab:uma:scopes:any' ]},
      { resource_id: 'urn:solidlab:uma:resources:any', resource_scopes: [ 'scope3' ]},
    ]);
  });
});
