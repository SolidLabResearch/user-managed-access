import {BadRequestHttpError} from '../http/errors/BadRequestHttpError';
import {HttpHandler} from '../http/models/HttpHandler';
import {HttpHandlerContext} from '../http/models/HttpHandlerContext';
import {HttpHandlerResponse} from '../http/models/HttpHandlerResponse';
import {UnauthorizedHttpError} from '../http/errors/UnauthorizedHttpError';
import {UnsupportedMediaTypeHttpError} from '../http/errors/UnsupportedMediaTypeHttpError';
import {from, map, Observable, throwError} from 'rxjs';
import * as jose from 'jose';
import {Logger} from '../logging/Logger';
import {getLoggerFor} from '../logging/LoggerUtils';
import {KeyValueStore} from '../storage/models/KeyValueStore';
import {Ticket} from '../models/Ticket';
import {assertPermissions} from '../models/Permission';
import {v4} from 'uuid';

type ErrorConstructor = { new(msg: string): Error };

/**
 * Registration for a Requesting Party (i.e. Pod Server)
 */
export class RequestingPartyRegistration {
  private publicKey: jose.KeyLike | undefined;
  /**
   * Registration for a Requesting Party (i.e. Pod Server)
   *
   * @param {string} baseUri - Base URI of the Pod Service
   * @param {string} ecPublicKey - Public Key of the Pod Service
   * @param {string} ecAlgorithm - Algorithm used
   */
  constructor(public readonly baseUri: string,
      public readonly ecPublicKey: string,
     public readonly ecAlgorithm: 'ES256' | 'ES384' | 'ES512') {}

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

export type PermissionRegistrationResponse = {
    ticket: string
}

/**
 * A PermissionRegistrationHandler is tasked with implementing
 * section 3.2 from the User-Managed Access (UMA) Profile of OAuth 2.0.
 *
 * It provides an endpoint to a Resource Server for requesting UMA tickets.
 */
export class PermissionRegistrationHandler implements HttpHandler {
  protected readonly logger: Logger = getLoggerFor(this);

  /**
   * A PermissionRegistrationHandler is tasked with implementing
   * section 3.2 from the User-Managed Access (UMA) Profile of OAuth 2.0.
   * @param {string} baseUrl - Base URL of the AS.
   * @param {RequestingPartyRegistration[]} resourceServers - Pod Servers to be registered with the UMA AS
   */
  constructor(
    private readonly baseUrl: string,
    private readonly ticketStore: KeyValueStore<string, Ticket>,
    private readonly resourceServers: RequestingPartyRegistration[],
  ) {}

  /**
  * Handle incoming requests for permission registration
  * @param {HttpHandlerContext} param0
  * @return {Observable<HttpHandlerResponse<PermissionRegistrationResponse>>}
  */
  handle({request}: HttpHandlerContext): Observable<HttpHandlerResponse<any>> {
    if (!request.headers.authorization) {
      return throwError(() => new UnauthorizedHttpError('Missing authorization header in request.'));
    }

    if (request.headers['content-type'] !== 'application/json') {
      return throwError(() => new UnsupportedMediaTypeHttpError(
          'Only Media Type "application/json" is supported for this route.'));
    }

    if (!request.body || !(request.body instanceof Object)) {
      return throwError(() => new BadRequestHttpError('Missing request body.'));
    }


    return from(this.processRequestingPartyRegistration(request.headers.authorization, request.body))
        .pipe(map((response) => {
          return {
            headers: {'content-type': 'application/json'},
            status: 200,
            body: response,
          };
        },
        ));
  }

  /**
   *
   * @param {string} authorizationHeader
   * @param {object} body
   * @return {Promise<PermissionRegistrationResponse>}
   */
  private async processRequestingPartyRegistration(authorizationHeader: string, body: any)
  : Promise<PermissionRegistrationResponse> {
    // TODO: validate PAT
    //await this.validateAuthorization(authorizationHeader);

    if (!body || !Array.isArray(body)) this.error(BadRequestHttpError, 'Request body must be a JSON array.');

this.logger.debug('PROCESS');
    try {
      assertPermissions(body);
    } catch (e) {
      this.logger.debug('Syntax error: ' + (e as Error).message, body);
      e instanceof Error 
        ? this.error(BadRequestHttpError, 'Request has bad syntax: ' + e.message)
        : this.error(BadRequestHttpError, 'Request has bad syntax');
    }
this.logger.debug('ASSERTED SYNTAX');
    const ticket = v4();
    this.ticketStore.set(ticket, body);
this.logger.debug('TICKET');
    return {ticket};
  }


  /**
   * Logs and throws an error
   *
   * @param {ErrorConstructor} constructor - the error constructor
   * @param {string} message - the error message
   */
  private error(constructor: ErrorConstructor, message: string): never {
    this.logger.error(message);
    throw new constructor(message);
  }


  /**
   * Validates authorization header in request.
   *
   * @param {string} authorization - Authorization header value
   */
  private async validateAuthorization(authorization: string): Promise<RequestingPartyRegistration> {
    if (!/^Bearer /ui.test(authorization)) {
      this.logger.debug('Missing Bearer authorization header.');
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
    this.logger.debug('Bearer token could not be matched against resource server.');
    throw new UnauthorizedHttpError('Bearer token is invalid.');
  }
}
