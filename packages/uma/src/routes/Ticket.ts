import {
  BadRequestHttpError,
  createErrorMessage,
  getLoggerFor,
  KeyValueStorage,
  UnauthorizedHttpError
} from '@solid/community-server';
import { randomUUID } from 'node:crypto';
import { TicketingStrategy } from '../ticketing/strategy/TicketingStrategy';
import { Ticket } from '../ticketing/Ticket';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';
import { verifyRequest } from '../util/HttpMessageSignatures';
import { array, reType } from '../util/ReType';
import { Permission } from '../views/Permission';

/**
 * A TicketRequestHandler is tasked with implementing
 * section 3.2 from the User-Managed Access (UMA) Profile of OAuth 2.0.
 *
 * It provides an endpoint to a Resource Server for requesting UMA tickets.
 */
export class TicketRequestHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  constructor(
    protected readonly ticketingStrategy: TicketingStrategy,
    protected readonly ticketStore: KeyValueStorage<string, Ticket>,
  ) {
    super();
  }

  async handle({request}: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    this.logger.info(`Received permission registration request.`);
    if (!await verifyRequest(request)) throw new UnauthorizedHttpError();

    try {
      reType(request.body, array(Permission));
    } catch (e) {
      this.logger.warn(`Syntax error: ${createErrorMessage(e)}, ${request.body}`);
      throw new BadRequestHttpError(`Request has bad syntax: ${createErrorMessage(e)}`);
    }

    const ticket = await this.ticketingStrategy.initializeTicket(request.body);
    const resolved = await this.ticketingStrategy.resolveTicket(ticket);

    if (resolved.success) return { status: 200 };

    const id = randomUUID();
    await this.ticketStore.set(id, ticket);

    return {
      status: 201,
      body: { ticket: id },
    };
  }
}
