import {BadRequestHttpError} from '../http/errors/BadRequestHttpError';
import {HttpHandlerContext} from '../http/models/HttpHandlerContext';
import {Authorizer} from '../models/Authorizer';
import {Principal} from '../models/AccessToken';
import {Ticket} from '../models/Ticket';
import {AccessToken} from '../models/AccessToken';
import {ClaimTokenProcessor, ClaimTokenRequest} from '../authn/ClaimTokenProcessor';
import {TokenFactory} from '../token/TokenFactory';
import {GrantTypeProcessor, TokenResponse} from '../grant/GrantTypeProcessor';
import {getLoggerFor} from '../logging/LoggerUtils';
import {Logger} from '../logging/Logger';
import {RequestDeniedError} from '../error/RequestDeniedError';
import {NeedInfoError} from '../error/NeedInfoError';
import {KeyValueStore} from '../storage/models/KeyValueStore';
import {v4} from 'uuid';

type ErrorConstructor = { new(msg: string): Error };

/**
 * A concrete Grant Processor for the 'urn:ietf:params:oauth:grant-type:uma-ticket' grant
 * type.
 */
export class UmaGrantProcessor extends GrantTypeProcessor {
  protected readonly logger: Logger = getLoggerFor(this);
  private readonly processors = new Map<string, ClaimTokenProcessor>();
  /**
     * Construct a new UmaGrantProcessor
     * @param {ClaimTokenProcessor[]} claimTokenProcessors - a list of registered processors for claim tokens.
     */
  public constructor(
      claimTokenProcessors: ClaimTokenProcessor[],
    private authorizers: Authorizer[],
    private ticketStore: KeyValueStore<string, Ticket>,
    private tokenFactory: TokenFactory,
  ) {
    super();
    claimTokenProcessors.forEach((value) => this.processors.set(value.claimTokenFormat(), value));
  }
  /**
     * Get Supported Grant Type URI
     * @return {string} Supported grant type URI
     */
  public getSupportedGrantType(): string {
    return 'urn:ietf:params:oauth:grant-type:uma-ticket';
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
   * Performs UMA grant processing on the form request body
   * with the given context and returns a TokenResponse for
   * the request.
   *
   * @param {TokenRequest} body - request body
   * @param {HttpHandlerContext} context - request context
   * @return {Promise<TokenResponse>} tokens - yielded tokens
   */
  public async process(body: Map<string, string>, context: HttpHandlerContext): Promise<TokenResponse> {
    const ticketId = body.get('ticket');
    if (!ticketId) this.error(BadRequestHttpError, 'The request is missing a ticket.');

    const request: ClaimTokenRequest = {
      claim_token: body.get('claim_token'),
      claim_token_format: body.get('claim_token_format'),
      url: context.request.url,
      method: context.request.method,
    };

    if (context.request.headers['dpop']) {
      request.dpop = context.request.headers['dpop'];
    }

    if (body.has('rpt')) {
      request.rpt = body.get('rpt');
    }

    // Extract metadata from ticket
    const ticket = await this.ticketStore.get(ticketId);
    if (!ticket) this.error(BadRequestHttpError, 'The provided ticket is not valid.');

    this.logger.debug(`processing ticket`, ticket);

    // Construct principal object
    const principal = await this.authenticate(request, ticket);
this.logger.debug(`authenticated`, principal);
    // Authorize request using principal
    const authorization = await this.authorize(principal, ticket);
this.logger.debug(`authorized`, authorization);
    if (authorization.permissions.length === 0) this.error(RequestDeniedError, 'Unable to authorize request.');

    this.logger.info(`Generating new Access Token for principal '${principal.webId}' and resources ${
      authorization.permissions.map((p) => p.resource_id).join(', ')
    }`);

    // Serialize Authorization into Access Token
    const {token, tokenType} = await this.tokenFactory.serialize({...principal, ...authorization});

    return {access_token: token, token_type: tokenType};
  }

  /**
   * Authenticates a claim token request, returning the authenticated Principal
   * object or throwing an error if the token request could not be authenticated.
   *
   * @param {ClaimTokenRequest} req - request
   * @param {Ticket} ticket
   * @return {Promise<Principal>} - authenticated principal
   */
  private async authenticate(req: ClaimTokenRequest, ticket: Ticket): Promise<Principal> {
    const {claim_token: token, claim_token_format: format} = req;

    if (token || format) {
      if (!token) this.error(BadRequestHttpError, 'Request with a "claim_token_format" must contain a "claim_token".');
      if (!format) this.error(BadRequestHttpError, 'Request with a "claim_token" must contain a "claim_token_format".');

      const processor = this.processors.get(format);
      if (!processor) this.error(BadRequestHttpError, 'The provided "claim_token_format" is not supported.');

      try {
        return await processor.process(req);
      } catch (e: any) {
        this.requireClaims(ticket, (e as Error).message);
      }
    }

    this.requireClaims(ticket);
  }

  /**
   * @param {Ticket} ticket
   * @param {string | undefined} msg
   */
  private requireClaims(ticket: Ticket, msg?: string): never {
    const newTicket = v4();
    this.ticketStore.set(newTicket, ticket);
    const response = {required_claims: {claim_token_format: Array.from(this.processors.keys())}};
    throw new NeedInfoError(msg ?? 'Need Info', newTicket, response);
  }

  /**
   * Authorize a new request based on ticket and principal.
   *
   * @param {Ticket} ticket - requested resource and modes
   * @param {Principal} principal - authenticated client
   * @return {Promise<Authorization>} - authorization decision
   */
  private async authorize(principal: Principal, ticket: Ticket): Promise<AccessToken> {
    const ps = Promise.all(this.authorizers.map(async (authorizer) => await authorizer.authorize(principal, ticket)));
    return {...principal, permissions: (await ps).flat()};
  }
}
