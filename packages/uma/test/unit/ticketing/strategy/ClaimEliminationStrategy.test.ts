import { Mocked } from 'vitest';
import { ClaimSet } from '../../../../src/credentials/ClaimSet';
import { Requirements } from '../../../../src/credentials/Requirements';
import { Authorizer } from '../../../../src/policies/authorizers/Authorizer';
import { ClaimEliminationStrategy } from '../../../../src/ticketing/strategy/ClaimEliminationStrategy';
import { Ticket } from '../../../../src/ticketing/Ticket';
import { Permission } from '../../../../src/views/Permission';

describe('ClaimEliminationStrategy', (): void => {
  const requirements: Requirements = { key: async() => true };
  const permissions: Permission[] = [ { resource_id: 'id', resource_scopes: [ 'scopes' ] } ];

  let authorizer: Mocked<Authorizer>;
  let strategy: ClaimEliminationStrategy;

  beforeEach(async(): Promise<void> => {
    authorizer = {
      credentials: vi.fn().mockResolvedValue(requirements),
      permissions: vi.fn(),
    };

    strategy = new ClaimEliminationStrategy(authorizer);
  });

  it('can initialize a ticket.', async(): Promise<void> => {
    await expect(strategy.initializeTicket(permissions)).resolves.toEqual({
      permissions,
      required: requirements,
      provided: {},
    });
  });

  it('can validate claims.', async(): Promise<void> => {
    const req1 = vi.fn().mockResolvedValue(true);
    const req2 = vi.fn().mockResolvedValue(false);
    const req3 = vi.fn().mockResolvedValue(false);
    const ticket: Ticket = {
      permissions,
      provided: {},
      required: [
        { claim1: req1, claim2: req2 },
        { claim3: req3 },
      ],
    };
    const claims: ClaimSet = { claim1: 'val1', claim2: 'val2' };
    await expect(strategy.validateClaims(ticket, claims)).resolves.toBe(ticket);
    expect(ticket).toEqual({
      permissions,
      provided: { claim1: 'val1', claim2: 'val2' },
      required: [
        { claim2: req2 },
        { claim3: req3 },
      ],
    });
    expect(req1).toHaveBeenCalledTimes(1);
    expect(req1).toHaveBeenLastCalledWith('val1');
    expect(req2).toHaveBeenCalledTimes(1);
    expect(req2).toHaveBeenLastCalledWith('val2');
    expect(req3).toHaveBeenCalledTimes(0);
  });

  it('successfully resolves a ticket if there are no requirements left.', async(): Promise<void> => {
    const ticket: Ticket = {
      permissions,
      provided: {},
      required: [{}],
    };
    await expect(strategy.resolveTicket(ticket)).resolves.toEqual({ success: true, value: permissions })
  });

  it('rejects a ticket if there are still requirements.', async(): Promise<void> => {
    const ticket: Ticket = {
      permissions,
      provided: {},
      required: [ requirements],
    };
    await expect(strategy.resolveTicket(ticket)).resolves.toEqual({ success: false, value: ticket.required })
  });
});
