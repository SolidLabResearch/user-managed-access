import { NoneAuthorizer } from '../../../../src/policies/authorizers/NoneAuthorizer';

describe('NoneAuthorizer', (): void => {
  const authorizer = new NoneAuthorizer();

  it('returns an empty list of permissions.', async(): Promise<void> => {
    await expect(authorizer.permissions({})).resolves.toEqual([]);
  });
});
