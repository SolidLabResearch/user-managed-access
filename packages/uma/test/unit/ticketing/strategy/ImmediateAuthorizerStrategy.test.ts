import { Mocked } from 'vitest';
import { ClaimSet } from '../../../../src/credentials/ClaimSet';
import { Authorizer } from '../../../../src/policies/authorizers/Authorizer';
import { ImmediateAuthorizerStrategy } from '../../../../src/ticketing/strategy/ImmediateAuthorizerStrategy';
import { Ticket } from '../../../../src/ticketing/Ticket';
import { Permission } from '../../../../src/views/Permission';

describe('ImmediateAuthorizerStrategy', (): void => {
  const permissions: Permission[] = [ { resource_id: 'id', resource_scopes: [ 'scopes' ] } ];

  let authorizer: Mocked<Authorizer>;
  let strategy: ImmediateAuthorizerStrategy;

  beforeEach(async(): Promise<void> => {
    authorizer = {
      permissions: vi.fn().mockResolvedValue(permissions),
    };

    strategy = new ImmediateAuthorizerStrategy(authorizer)
  });

  it('initializes a ticket with empty requirements.', async(): Promise<void> => {
    await expect(strategy.initializeTicket(permissions)).resolves.toEqual({
      permissions,
      provided: {},
    });
  });

  it('validates the claims by adding them to the provided field.', async(): Promise<void> => {
    const ticket: Ticket = {
      permissions,
      provided: {},
    };
    const claims: ClaimSet = { claim1: 'val1', claim2: 'val2' };
    await expect(strategy.validateClaims(ticket, claims)).resolves.toEqual({
      permissions,
      provided: { claim1: 'val1', claim2: 'val2' },
    });
  });

  it('resolves tickets if it provides permissions.', async(): Promise<void> => {
    const ticket: Ticket = {
      permissions,
      provided: {},
    };
    const authResponse: Permission[] = [
      { resource_id: 'id', resource_scopes: [ 'scopes' ] }
    ];
    authorizer.permissions.mockResolvedValueOnce(authResponse);
    await expect(strategy.resolveTicket(ticket)).resolves
      .toEqual({ success: true, value: [{ resource_id: 'id', resource_scopes: [ 'scopes' ] }] });
  });

  it('rejects a ticket if it does not provide permissions.', async(): Promise<void> => {
    const ticket: Ticket = {
      permissions,
      provided: {},
    };
    const authResponse: Permission[] = [
      { resource_id: 'id1', resource_scopes: [ 'scope1' ] },
      { resource_id: 'id2', resource_scopes: [ 'scope2' ] }
    ];
    authorizer.permissions.mockResolvedValueOnce(authResponse);
    await expect(strategy.resolveTicket(ticket)).resolves
      .toEqual({ success: false, value: [{ resource_scopes: ['scopes'] }] });
  });
});
