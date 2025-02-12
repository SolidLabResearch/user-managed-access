import {
  BadRequestHttpError,
  createErrorMessage,
  getLoggerFor,
  HttpErrorClass,
  KeyValueStorage,
  UnauthorizedHttpError,
  UnsupportedMediaTypeHttpError
} from '@solid/community-server';
import { v4 } from 'uuid';
import { TicketingStrategy } from '../ticketing/strategy/TicketingStrategy';
import { Ticket } from '../ticketing/Ticket';
import { HttpHandler } from '../util/http/models/HttpHandler';
import { HttpHandlerContext } from '../util/http/models/HttpHandlerContext';
import { HttpHandlerResponse } from '../util/http/models/HttpHandlerResponse';
import { verifyRequest } from '../util/HttpMessageSignatures';
import { array, reType } from '../util/ReType';
import { Permission } from '../views/Permission';

/**
 * A TicketRequestHandler is tasked with implementing
 * section 3.2 from the User-Managed Access (UMA) Profile of OAuth 2.0.
 *
 * It provides an endpoint to a Resource Server for requesting UMA tickets.
 */
export class TicketRequestHandler implements HttpHandler {
  protected readonly logger = getLoggerFor(this);

  /**
   * A TicketRequestHandler is tasked with implementing
   * section 3.2 from the User-Managed Access (UMA) Profile of OAuth 2.0.
   * @param {RequestingPartyRegistration[]} resourceServers - Pod Servers to be registered with the UMA AS
   */
  constructor(
    private readonly ticketingStrategy: TicketingStrategy,
    private readonly ticketStore: KeyValueStorage<string, Ticket>,
  ) {}

  /**
  * Handle incoming requests for permission registration
  * @param {HttpHandlerContext} param0
  * @return {Observable<HttpHandlerResponse<PermissionRegistrationResponse>>}
  */
  async handle({request}: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    this.logger.info(`Received permission registration request.`);
    if (!await verifyRequest(request)) throw new UnauthorizedHttpError();

    if (request.headers['content-type'] !== 'application/json') {
      throw new UnsupportedMediaTypeHttpError(
          'Only Media Type "application/json" is supported for this route.');
    }

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

    const id = v4();
    this.ticketStore.set(id, ticket);

    return {
      headers: {'content-type': 'application/json'},
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
