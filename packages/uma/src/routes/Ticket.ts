import { BadRequestHttpError } from '../util/http/errors/BadRequestHttpError';
import { HttpHandler } from '../util/http/models/HttpHandler';
import { HttpHandlerContext } from '../util/http/models/HttpHandlerContext';
import { HttpHandlerResponse } from '../util/http/models/HttpHandlerResponse';
import { UnauthorizedHttpError } from '../util/http/errors/UnauthorizedHttpError';
import { UnsupportedMediaTypeHttpError } from '../util/http/errors/UnsupportedMediaTypeHttpError';
import * as jose from 'jose';
import { Logger } from '../util/logging/Logger';
import { getLoggerFor } from '../util/logging/LoggerUtils';
import { array, reType } from '../util/ReType';
import { Permission } from '../views/Permission';
import { Ticket } from '../ticketing/Ticket';
import { KeyValueStore } from '../util/storage/models/KeyValueStore';
import { TicketingStrategy } from '../ticketing/strategy/TicketingStrategy';
import { v4 } from 'uuid';

type ErrorConstructor = { new(msg: string): Error };

/**
 * Registration for a Requesting Party (i.e. Pod Server)
 */
export class RequestingPartyRegistration {
  private publicKey: jose.KeyLike | undefined;
  /**
   * Registration for a Requesting Party (i.e. Pod Server)
   *
   * @param {string} baseUrl - Base URI of the Pod Service
   * @param {string} ecPublicKey - Public Key of the Pod Service
   * @param {string} ecAlgorithm - Algorithm used
   */
  constructor(
    public readonly baseUrl: string,
    public readonly ecPublicKey: string,
    public readonly ecAlgorithm: 'ES256' | 'ES384' | 'ES512'
  ) {}

  /**
   * Get Public Key
   * @return {Promise<jose.KeyLike>} public key
   */
  public async getPublicKey(): Promise<jose.KeyLike> {
    if (!this.publicKey) {
      this.publicKey = await jose.importSPKI(this.ecPublicKey, this.ecAlgorithm);
    }
    return this.publicKey;
  }
}

/**
 * A TicketRequestHandler is tasked with implementing
 * section 3.2 from the User-Managed Access (UMA) Profile of OAuth 2.0.
 *
 * It provides an endpoint to a Resource Server for requesting UMA tickets.
 */
export class TicketRequestHandler implements HttpHandler {
  protected readonly logger: Logger = getLoggerFor(this);

  /**
   * A TicketRequestHandler is tasked with implementing
   * section 3.2 from the User-Managed Access (UMA) Profile of OAuth 2.0.
   * @param {string} baseUrl - Base URL of the AS.
   * @param {RequestingPartyRegistration[]} resourceServers - Pod Servers to be registered with the UMA AS
   */
  constructor(
    private readonly baseUrl: string,
    private readonly ticketingStrategy: TicketingStrategy,
    private readonly ticketStore: KeyValueStore<string, Ticket>,
    private readonly resourceServers: RequestingPartyRegistration[],
  ) {}

  /**
  * Handle incoming requests for permission registration
  * @param {HttpHandlerContext} param0
  * @return {Observable<HttpHandlerResponse<PermissionRegistrationResponse>>}
  */
  async handle({request}: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    this.logger.info('Received permission registration request.', request);

    if (!request.headers.authorization) {
      throw new UnauthorizedHttpError('Missing authorization header in request.');
    }

    if (request.headers['content-type'] !== 'application/json') {
      throw new UnsupportedMediaTypeHttpError(
          'Only Media Type "application/json" is supported for this route.');
    }

    if (!request.body || !(request.body instanceof Object)) {
      throw new BadRequestHttpError('Missing request body.');
    }

    const ticket = await this.processRequestingPartyRegistration(request.headers.authorization, request.body);
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
   *
   * @param {string} authorizationHeader
   * @param {object} body
   * @return {Promise<PermissionRegistrationResponse>}
   */
  private async processRequestingPartyRegistration(authorizationHeader: string, body: any)
  : Promise<Ticket> {
    // TODO: validate PAT
    //await this.validateAuthorization(authorizationHeader);

    if (!body || !Array.isArray(body)) this.error(BadRequestHttpError, 'Request body must be a JSON array.');

    try {
      reType(body, array(Permission));
    } catch (e) {
      this.logger.debug('Syntax error: ' + (e as Error).message, body);
      e instanceof Error 
        ? this.error(BadRequestHttpError, 'Request has bad syntax: ' + e.message)
        : this.error(BadRequestHttpError, 'Request has bad syntax');
    }

    const ticket = await this.ticketingStrategy.initializeTicket(body);

    return ticket;
  }


  /**
   * Logs and throws an error
   *
   * @param {ErrorConstructor} constructor - the error constructor
   * @param {string} message - the error message
   */
  private error(constructor: ErrorConstructor, message: string): never {
    this.logger.warn(message);
    throw new constructor(message);
  }


  /**
   * Validates authorization header in request.
   *
   * @param {string} authorization - Authorization header value
   */
  private async validateAuthorization(authorization: string): Promise<RequestingPartyRegistration> {
    if (!/^Bearer /ui.test(authorization)) {
      this.logger.warn('Missing Bearer authorization header.');
      throw new BadRequestHttpError('Expected Bearer authorization header.');
    }
    // TODO: prevent replay.

    const jwt = /^Bearer\s+(.*)/ui.exec(authorization!)![1];

    for (const resourceServer of this.resourceServers) {
      const publicKey = await resourceServer.getPublicKey();
      try {
        await jose.jwtVerify(jwt, publicKey, {
          audience: this.baseUrl,
        });
        return resourceServer;
      } catch (e) {
      // ignored
      }
    }

    this.logger.warn('Bearer token could not be matched against resource server.');
    throw new UnauthorizedHttpError('Bearer token is invalid.');
  }
}
