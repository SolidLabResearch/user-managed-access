import { KeyValueStorage, UnauthorizedHttpError } from '@solid/community-server';
import { Mocked } from 'vitest';
import { TicketRequestHandler } from '../../../src/routes/Ticket';
import { TicketingStrategy } from '../../../src/ticketing/strategy/TicketingStrategy';
import { Ticket } from '../../../src/ticketing/Ticket';
import { HttpHandlerContext } from '../../../src/util/http/models/HttpHandler';
import * as signatures from '../../../src/util/HttpMessageSignatures';

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('1-2-3-4-5'),
}));

describe('Ticket', (): void => {
  let request: HttpHandlerContext;
  const verifyRequest = vi.spyOn(signatures, 'verifyRequest');

  let ticketingStrategy: Mocked<TicketingStrategy>;
  let ticketStore: Mocked<KeyValueStorage<string, Ticket>>;
  let handler: TicketRequestHandler;

  beforeEach(async(): Promise<void> => {
    vi.clearAllMocks();
    verifyRequest.mockResolvedValue(true);

    request = { request: { body: [{
      resource_id: 'id',
      resource_scopes: [ 'scope' ],
    }]}} as any;

    ticketingStrategy = {
      initializeTicket: vi.fn().mockResolvedValue('ticket'),
      resolveTicket: vi.fn(),
      validateClaims: vi.fn(),
    };

    ticketStore = {
      set: vi.fn(),
    } satisfies Partial<KeyValueStorage<string, Ticket>> as any;

    handler = new TicketRequestHandler(ticketingStrategy, ticketStore);
  });

  it('errors if the request is not authorized.', async(): Promise<void> => {
    verifyRequest.mockResolvedValueOnce(false);
    await expect(handler.handle(request)).rejects.toThrow(UnauthorizedHttpError);
    expect(verifyRequest).toHaveBeenCalledTimes(1);
    expect(verifyRequest).toHaveBeenLastCalledWith(request.request);
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
});
