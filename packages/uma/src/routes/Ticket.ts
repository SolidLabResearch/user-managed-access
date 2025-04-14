import {
  BadRequestHttpError,
  createErrorMessage,
  getLoggerFor,
  HttpErrorClass,
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
    private readonly ticketingStrategy: TicketingStrategy,
    private readonly ticketStore: KeyValueStorage<string, Ticket>,
  ) {
    super();
  }

  async handle({request}: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    this.logger.info(`Received permission registration request.`);
    if (!await verifyRequest(request)) throw new UnauthorizedHttpError();

    if (!request.body || !Array.isArray(request.body)) {
      this.error(BadRequestHttpError, 'Request body must be a JSON array.');
    }

    try {
      reType(request.body, array(Permission));
    } catch (e) {
      this.logger.debug(`Syntax error: ${createErrorMessage(e)}, ${request.body}`);
      e instanceof Error
        ? this.error(BadRequestHttpError, 'Request has bad syntax: ' + e.message)
        : this.error(BadRequestHttpError, 'Request has bad syntax');
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

  /**
   * Logs and throws an error
   *
   * @param {HttpErrorClass} constructor - the error constructor
   * @param {string} message - the error message
   */
  private error(constructor: HttpErrorClass, message: string): never {
    this.logger.warn(message);
    throw new constructor(message);
  }
}
