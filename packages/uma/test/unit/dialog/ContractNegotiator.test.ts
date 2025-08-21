import { ForbiddenHttpError, KeyValueStorage } from '@solid/community-server';
import { Mocked, MockInstance } from 'vitest';
import { ClaimSet } from '../../../src/credentials/ClaimSet';
import { Verifier } from '../../../src/credentials/verify/Verifier';
import { ContractNegotiator } from '../../../src/dialog/ContractNegotiator';
import { DialogInput } from '../../../src/dialog/Input';
import { ContractManager } from '../../../src/policies/contracts/ContractManager';
import { TicketingStrategy } from '../../../src/ticketing/strategy/TicketingStrategy';
import { Ticket } from '../../../src/ticketing/Ticket';
import { SerializedToken, TokenFactory } from '../../../src/tokens/TokenFactory';
import { ODRLContract } from '../../../src/views/Contract';

// vi.mock('../../../src/policies/contracts/ContractManager', () => ({
//   ContractManager: vi.fn().mockReturnValue({
//     createContract: vi.fn(),
//     findContract: vi.fn(),
//   }),
// }))

describe('ContractNegotiator', (): void => {
  const input: DialogInput = {
    permissions: [
      { resource_id: 'id1', resource_scopes: [ 'scope1' ] },
      { resource_id: 'id2', resource_scopes: [ 'scope2' ] },
    ]
  };
  const claims: ClaimSet = { claim1: 'value1', claim2: 'value2' };
  const ticket: Ticket = {
    permissions: [ { resource_id: 'id1', resource_scopes: [ 'scope1' ] } ],
    required: [],
    provided: { claim: 'value' },
  };
  const token: SerializedToken = { token: 'token', tokenType: 'type' };
  const contract: ODRLContract = {
    uid: 'contractId',
    permission: [{
      action: 'urn:example:css:modes:action',
      target: 'target',
      assigner: 'assigner',
      assignee: 'assignee',
    }],
  };

  let ticketData: Map<string, Ticket>;

  let findContractMock: MockInstance<typeof ContractManager.prototype.findContract>;
  let createContractMock: MockInstance<typeof ContractManager.prototype.createContract>;
  let fetchMock: MockInstance<typeof fetch>;

  let verifier: Mocked<Verifier>
  let ticketStore: Mocked<KeyValueStorage<string, Ticket>>;
  let ticketingStrategy: Mocked<TicketingStrategy>;
  let tokenFactory: Mocked<TokenFactory>;

  let negotiator: ContractNegotiator;

  beforeEach(async(): Promise<void> => {
    findContractMock = vi.spyOn(ContractManager.prototype, 'findContract').mockReturnValue(contract);
    createContractMock = vi.spyOn(ContractManager.prototype, 'createContract').mockReturnValue(contract);
    fetchMock = vi.spyOn(global, 'fetch').mockImplementation(vi.fn());

    verifier = {
      verify: vi.fn().mockResolvedValue(claims),
    };

    ticketData = new Map<string, Ticket>();
    ticketStore = {
      has: vi.fn().mockImplementation(key => ticketData.has(key)),
      get: vi.fn().mockImplementation(key => ticketData.get(key)),
      set: vi.fn().mockImplementation((key, value) => ticketData.set(key, value)),
      delete: vi.fn().mockImplementation(key => ticketData.delete(key)),
      entries: vi.fn().mockImplementation(() => ticketData.entries()),
    };

    ticketingStrategy = {
      initializeTicket: vi.fn().mockResolvedValue(ticket),
      validateClaims: vi.fn().mockResolvedValue(ticket),
      resolveTicket: vi.fn().mockResolvedValue({
        success: true,
        value: { resource_id: 'id1', resource_scopes: [ 'scope1' ] },
      }),
    };

    tokenFactory = {
      serialize: vi.fn().mockResolvedValue(token),
      deserialize: vi.fn(),
    };

    negotiator = new ContractNegotiator(verifier, ticketStore, ticketingStrategy, tokenFactory);
  });

  it('adds an existing contract if there is one.', async(): Promise<void> => {
    await expect(negotiator.negotiate(input)).resolves.toEqual({ access_token: 'token', token_type: 'type' });
    expect(findContractMock).toHaveBeenCalledTimes(1);
    expect(findContractMock).toHaveBeenLastCalledWith(ticket);
    expect(createContractMock).toHaveBeenCalledTimes(0);
    expect(ticketingStrategy.initializeTicket).toHaveBeenCalledTimes(1);
    expect(ticketingStrategy.resolveTicket).toHaveBeenCalledTimes(0);
    expect(tokenFactory.serialize).toHaveBeenCalledTimes(1);
    expect(tokenFactory.serialize).toHaveBeenLastCalledWith({
      contract: contract,
      permissions: [{ resource_id: 'target', resource_scopes: [ 'https://w3id.org/oac#action' ] }],
    });

    // Sending to hardcoded URL
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:3000/ruben/settings/policies/instantiated/', {
      method: 'POST',
      headers: { 'content-type': 'application/ld+json' },
      body: JSON.stringify(contract),
    });
  });

  it('creates a new contract when needed.', async(): Promise<void> => {
    findContractMock.mockReturnValueOnce(undefined);
    await expect(negotiator.negotiate(input)).resolves.toEqual({ access_token: 'token', token_type: 'type' });
    expect(findContractMock).toHaveBeenCalledTimes(1);
    expect(findContractMock).toHaveBeenLastCalledWith(ticket);
    expect(createContractMock).toHaveBeenCalledTimes(1);
    expect(createContractMock).toHaveBeenLastCalledWith({ resource_id: 'id1', resource_scopes: [ 'scope1' ] });
    expect(ticketingStrategy.initializeTicket).toHaveBeenCalledTimes(1);
    expect(ticketingStrategy.resolveTicket).toHaveBeenCalledTimes(1);
    expect(ticketingStrategy.resolveTicket).toHaveBeenLastCalledWith(ticket);
    expect(tokenFactory.serialize).toHaveBeenCalledTimes(1);
    expect(tokenFactory.serialize).toHaveBeenLastCalledWith({
      contract: contract,
      permissions: [{ resource_id: 'target', resource_scopes: [ 'https://w3id.org/oac#action' ] }],
    });

    // Sending to hardcoded URL
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:3000/ruben/settings/policies/instantiated/', {
      method: 'POST',
      headers: { 'content-type': 'application/ld+json' },
      body: JSON.stringify(contract),
    });
  });

  it('throws an empty 403 if the token is rejected with no requirements.', async(): Promise<void> => {
    findContractMock.mockReturnValueOnce(undefined);
    ticketingStrategy.resolveTicket.mockResolvedValueOnce({ success: false, value: [] });
    await expect(negotiator.negotiate(input)).rejects.toThrow(ForbiddenHttpError);
    expect(ticketStore.set).toHaveBeenCalledTimes(0);
  });
});
