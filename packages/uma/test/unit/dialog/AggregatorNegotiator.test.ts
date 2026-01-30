import { KeyValueStorage } from '@solid/community-server';
import { Mocked } from 'vitest';
import { AggregatorNegotiator } from '../../../src/dialog/AggregatorNegotiator';
import { DialogInput } from '../../../src/dialog/Input';
import { Negotiator } from '../../../src/dialog/Negotiator';
import { DialogOutput } from '../../../src/dialog/Output';
import { Ticket } from '../../../src/ticketing/Ticket';
import { decodeAggregateId, encodeAggregateId } from '../../../src/util/AggregatorUtil';
import { RegistrationStore } from '../../../src/util/RegistrationStore';

describe('AggregatorNegotiator', (): void => {
  let input: DialogInput;
  let output: DialogOutput;
  let ticket: Ticket;
  let source: Mocked<Negotiator>;
  let ticketStore: Mocked<KeyValueStorage<string, Ticket>>;
  let registrationStore: Mocked<RegistrationStore>;
  let negotiator: AggregatorNegotiator;

  beforeEach(async(): Promise<void> => {
    input = {
      grant_type: 'grant',
      ticket: 'ticket',
      scope: 'urn:knows:uma:scopes:derivation-creation',
    };

    output = {
      access_token: 'access_token',
      token_type: 'Bearer',
    };

    ticket = {
      permissions: [{ resource_id: 'id', resource_scopes: [ 'scope' ] }],
      provided: {},
    };

    source = {
      negotiate: vi.fn().mockResolvedValue(output),
    } satisfies Partial<Negotiator> as any;

    ticketStore = {
      get: vi.fn().mockResolvedValue(ticket),
      set: vi.fn(),
    } satisfies Partial<KeyValueStorage<string, Ticket>> as any;

    registrationStore = {} satisfies Partial<RegistrationStore> as any;

    negotiator = new AggregatorNegotiator(source, ticketStore, registrationStore);
  });

  it('returns the source result if the scope has not been set.', async(): Promise<void> => {
    input = {};
    await expect(negotiator.negotiate(input)).resolves.toEqual(output);
    expect(source.negotiate).toHaveBeenCalledExactlyOnceWith(input);
  });

  it('errors if there are multiple target resources in the ticket.', async(): Promise<void> => {
    ticket.permissions = [
      { resource_id: 'id1', resource_scopes: [ 'scope1' ] },
      { resource_id: 'id1', resource_scopes: [ 'scope2' ] },
    ];
    await expect(negotiator.negotiate(input)).rejects
      .toThrow('Aggregate token requests require exactly 1 target resource identifier');
    expect(source.negotiate).toHaveBeenCalledTimes(0);
    expect(ticketStore.get).toHaveBeenCalledExactlyOnceWith('ticket');
  });

  it('errors if no ticket was found.', async(): Promise<void> => {
    ticketStore.get.mockResolvedValueOnce(undefined);
    await expect(negotiator.negotiate(input)).rejects.toThrow('Unknown ticket ID');
    expect(source.negotiate).toHaveBeenCalledTimes(0);
    expect(ticketStore.get).toHaveBeenCalledExactlyOnceWith('ticket');
  });

  it('errors if no ticket was provided.', async(): Promise<void> => {
    delete input.ticket;
    await expect(negotiator.negotiate(input)).rejects.toThrow('Aggregators are only supported when using tickets.');
    expect(source.negotiate).toHaveBeenCalledTimes(0);
  });

  it('adds a derivation ID if negotiation was successful.', async(): Promise<void> => {
    const result = await negotiator.negotiate(input);
    expect(result.derivation_resource_id).toBeDefined();
    expect(result).toEqual({
      ...output,
      derivation_resource_id: result.derivation_resource_id,
    });
    await expect(decodeAggregateId(result.derivation_resource_id!)).resolves.toBe('id');
    expect(ticketStore.set).toHaveBeenCalledExactlyOnceWith('ticket', {
      permissions: [{ resource_id: 'id', resource_scopes: [ 'scope', 'urn:knows:uma:scopes:derivation-creation' ] }],
      provided: {},
    });
    expect(ticketStore.set).toHaveBeenCalledBefore(source.negotiate);
  });
});
