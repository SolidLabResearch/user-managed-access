import { randomUUID } from 'node:crypto';
import { Ticket } from '../ticketing/Ticket';
import { Verifier } from '../credentials/verify/Verifier';
import { TokenFactory } from '../tokens/TokenFactory';
import { Negotiator } from './Negotiator';
import { NeedInfoError } from '../errors/NeedInfoError';
import { DialogInput } from './Input';
import { DialogOutput } from './Output';
import { reType } from '../util/ReType';
import { TicketingStrategy } from '../ticketing/strategy/TicketingStrategy';
import {
  BadRequestHttpError,
  ForbiddenHttpError,
  getLoggerFor,
  HttpErrorClass,
  KeyValueStorage } from '@solid/community-server';
import { getOperationLogger } from '../logging/OperationLogger';
import { serializePolicyInstantiation } from '../logging/OperationSerializer';

/**
 * A concrete Negotiator that verifies incoming Claims and processes Tickets
 * according to a TicketingStrategy.
 */
export class BaseNegotiator implements Negotiator {
  protected readonly logger = getLoggerFor(this);
  operationLogger = getOperationLogger();

  /**
   * Construct a new Negotiator
   * @param verifier - The Verifier used to verify Claims of incoming Credentials.
   * @param ticketStore - A KeyValueStorage to track Tickets.
   * @param ticketManager - The strategy describing the life cycle of a Ticket.
   * @param tokenFactory - A factory for minting Access Tokens.
   */
  public constructor(
    protected verifier: Verifier,
    protected ticketStore: KeyValueStorage<string, Ticket>,
    protected ticketingStrategy: TicketingStrategy,
    protected tokenFactory: TokenFactory,
  ) {}

  /**
   * Performs UMA grant negotiation.
   *
   * @param {TokenRequest} body - request body
   * @param {HttpHandlerContext} context - request context
   * @return {Promise<TokenResponse>} tokens - yielded tokens
   */
  public async negotiate(input: DialogInput): Promise<DialogOutput> {
    reType(input, DialogInput);

    // Create or retrieve ticket
    const ticket = await this.getTicket(input);
    this.logger.debug(`Processing ticket. ${JSON.stringify(ticket)}`);

    // Process pushed credentials
    const updatedTicket = await this.processCredentials(input, ticket);
    this.logger.debug(`resolved result ${JSON.stringify(updatedTicket)}`);

    // Try to resolve ticket ...
    const resolved = await this.ticketingStrategy.resolveTicket(updatedTicket);
    this.logger.debug(`Resolved ticket ${JSON.stringify(resolved)}`);

    // ... on success, create Access Token
    if (resolved.success) {

      // Retrieve / create instantiated policy
      const { token, tokenType } = await this.tokenFactory.serialize({ permissions: resolved.value });
      this.logger.debug(`Minted token ${JSON.stringify(token)}`);

      // TODO:: test logging
      this.operationLogger.addLogEntry(serializePolicyInstantiation())

      // TODO:: dynamic contract link to stored signed contract.
      // If needed we can always embed here directly into the return JSON
      return ({
        access_token: token,
        token_type: tokenType,
      });
    }

    // ... on failure, deny if no solvable requirements
    this.denyRequest(ticket);
  }

  // TODO:
  protected denyRequest(ticket: Ticket): never {
    const requiredClaims = ticket.required.map(req => Object.keys(req));
    if (requiredClaims.length === 0) throw new ForbiddenHttpError();

    // ... require more info otherwise
    const id = randomUUID();
    this.ticketStore.set(id, ticket);
    throw new NeedInfoError('Need more info to authorize request ...', id, {
      required_claims: {
        claim_token_format: requiredClaims,
      },
    });
  }

  /**
   * Helper function that retrieves a Ticket from the TicketStore if it exists,
   * or initializes a new one otherwise.
   *
   * @param input - The input of the negotiation dialog.
   *
   * @returns The Ticket describing the dialog at hand.
   */
  protected async getTicket(input: DialogInput): Promise<Ticket> {
    const { ticket, permissions } = input;

    if (ticket) {
      const stored = await this.ticketStore.get(ticket);
      if (!stored) this.error(BadRequestHttpError, 'The provided ticket is not valid.');

      await this.ticketStore.delete(ticket);
      return stored;
    }

    if (!permissions) {
      this.error(BadRequestHttpError, 'A token request without existing ticket should include requested permissions.');
    }

    return await this.ticketingStrategy.initializeTicket(permissions);
  }

  /**
   * Helper function that checks for the presence of Credentials and, if present,
   * verifies them and validates them in context of the provided Ticket.
   *
   * @param input - The input of the negotiation dialog.
   * @param ticket - The Ticket against which to validate any Credentials.
   *
   * @returns An updated Ticket in which the Credentials have been validated.
   */
  protected async processCredentials(input: DialogInput, ticket: Ticket): Promise<Ticket> {
    const { claim_token: token, claim_token_format: format } = input;

    if (token || format) {
      if (!token) this.error(BadRequestHttpError, 'Request with a "claim_token_format" must contain a "claim_token".');
      if (!format) this.error(BadRequestHttpError, 'Request with a "claim_token" must contain a "claim_token_format".');

      const claims = await this.verifier.verify({ token, format });

      return await this.ticketingStrategy.validateClaims(ticket, claims);
    }

    return ticket;
  }

  /**
   * Logs and throws an error
   *
   * @param {HttpErrorClass} constructor - The error constructor.
   * @param {string} message - The error message.
   *
   * @throws An Error constructed with the provided constructor with the
   * provided message
   */
  protected error(constructor: HttpErrorClass, message: string): never {
    this.logger.warn(message);
    throw new constructor(message);
  }
}
