import { KeyValueStorage, UnauthorizedHttpError } from '@solid/community-server';
import { Mocked } from 'vitest';
import { TicketRequestHandler } from '../../../src/routes/Ticket';
import { TicketingStrategy } from '../../../src/ticketing/strategy/TicketingStrategy';
import { Ticket } from '../../../src/ticketing/Ticket';
import { HttpHandlerContext } from '../../../src/util/http/models/HttpHandler';
import { RequestValidator } from '../../../src/util/http/validate/RequestValidator';
import * as signatures from '../../../src/util/HttpMessageSignatures';
import { RegistrationStore } from '../../../src/util/RegistrationStore';
import { ResourceDescription } from '../../../src/views/ResourceDescription';

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('1-2-3-4-5'),
}));

describe('Ticket', (): void => {
  const owner = 'owner';
  let request: HttpHandlerContext;

  let ticketingStrategy: Mocked<TicketingStrategy>;
  let ticketStore: Mocked<KeyValueStorage<string, Ticket>>;
  let registrationStore: Mocked<RegistrationStore>;
  let validator: Mocked<RequestValidator>;
  let handler: TicketRequestHandler;

  beforeEach(async(): Promise<void> => {
    vi.clearAllMocks();

    request = { request: { body: [{
      resource_id: 'id',
      resource_scopes: [ 'scope' ],
    }]}} as any;

    ticketingStrategy = {
      initializeTicket: vi.fn().mockResolvedValue('ticket'),
      resolveTicket: vi.fn(),
      validateClaims: vi.fn(),
    };

    registrationStore = {
      has: vi.fn().mockResolvedValue(true),
    } satisfies Partial<KeyValueStorage<string, ResourceDescription>> as any;

    ticketStore = {
      set: vi.fn(),
    } satisfies Partial<KeyValueStorage<string, Ticket>> as any;

    validator = {
      handleSafe: vi.fn().mockResolvedValue({ owner }),
    } satisfies Partial<RequestValidator> as any;

    handler = new TicketRequestHandler(ticketingStrategy, ticketStore, registrationStore, validator);
  });

  it('throws an error if the body is invalid.', async(): Promise<void> => {
    request.request.body = 'apple';
    await expect(handler.handle(request)).rejects.toThrow('Request has bad syntax: value is not an array');
  });

  it('sends a 200 response if the initialized ticket is immediately resolved.', async(): Promise<void> => {
    ticketingStrategy.resolveTicket.mockResolvedValue({ success: true, value: [] });
    await expect(handler.handle(request)).resolves.toEqual({ status: 200 });
    expect(ticketStore.set).toHaveBeenCalledTimes(0);
  });

  it('sends a 201 response with the initialized ticket.', async(): Promise<void> => {
    ticketingStrategy.resolveTicket.mockResolvedValue({ success: false, value: [] });
    await expect(handler.handle(request)).resolves.toEqual({ status: 201, body: { ticket: '1-2-3-4-5' }});
    expect(ticketStore.set).toHaveBeenCalledTimes(1);
    expect(ticketStore.set).toHaveBeenLastCalledWith('1-2-3-4-5', 'ticket');
  });

  it('returns with invalid_resource_id if one of the targets is unknown.', async(): Promise<void> => {
    request.request.body = [
      { resource_id: 'id1', resource_scopes: [ 'scope1' ]},
      { resource_id: 'id2', resource_scopes: [ 'scope2' ]},
    ];
    registrationStore.has.mockResolvedValueOnce(true);
    registrationStore.has.mockResolvedValueOnce(false);
    await expect(handler.handle(request)).resolves
      .toEqual({ status: 400, body: { error: 'invalid_resource_id', error_description: 'Unknown UMA ID id2' }});
    expect(ticketStore.set).toHaveBeenCalledTimes(0);
  });
});
