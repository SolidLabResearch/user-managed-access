import {
  BadRequestHttpError,
  createErrorMessage,
  ForbiddenHttpError,
  HttpErrorClass,
  joinUrl,
  KeyValueStorage
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { createRemoteJWKSet, decodeJwt, jwtVerify, JWTPayload } from 'jose';
import { randomUUID } from 'node:crypto';
import { ClaimSet } from '../credentials/ClaimSet';
import { Verifier } from '../credentials/verify/Verifier';
import {
  ACCESS_TOKEN_CLAIM_FORMAT,
  DERIVATION_ACCESS_CLAIM_TYPE,
  DERIVATION_CREATION_SCOPE,
  DerivationRequiredClaim,
  derivationRequirementKey,
  hasScope
} from '../derivation/Derivation';
import { NeedInfoError } from '../errors/NeedInfoError';
import { getOperationLogger } from '../logging/OperationLogger';
import { serializePolicyInstantiation } from '../logging/OperationSerializer';
import { TicketingStrategy } from '../ticketing/strategy/TicketingStrategy';
import { Ticket } from '../ticketing/Ticket';
import { TokenFactory } from '../tokens/TokenFactory';
import { RegistrationStore } from '../util/RegistrationStore';
import { reType } from '../util/ReType';
import { DialogInput } from './Input';
import { Negotiator } from './Negotiator';
import { DialogOutput } from './Output';

/**
 * A concrete Negotiator that verifies incoming Claims and processes Tickets
 * according to a TicketingStrategy.
 */
export class BaseNegotiator implements Negotiator {
  protected readonly logger = getLoggerFor(this);
  protected readonly operationLogger = getOperationLogger();

  /**
   * Construct a new Negotiator
   * @param verifier - The Verifier used to verify Claims of incoming Credentials.
   * @param ticketStore - A KeyValueStorage to track Tickets.
   * @param ticketingStrategy - The strategy describing the life cycle of a Ticket.
   * @param tokenFactory - A factory for minting Access Tokens.
   */
  public constructor(
    protected verifier: Verifier,
    protected ticketStore: KeyValueStorage<string, Ticket>,
    protected ticketingStrategy: TicketingStrategy,
    protected tokenFactory: TokenFactory,
    protected registrationStore?: RegistrationStore,
  ) {}

  /**
   * Performs UMA grant negotiation.
   */
  public async negotiate(input: DialogInput): Promise<DialogOutput> {
    reType(input, DialogInput);

    // Create or retrieve ticket
    const ticket = await this.getTicket(input);
    this.logger.debug(`Processing ticket. ${JSON.stringify(ticket)}`);

    // Process pushed credentials
    const updatedTicket = await this.processCredentials(input, ticket);
    this.logger.debug(`resolved result ${JSON.stringify(updatedTicket)}`);

    if (!this.hasRequiredDerivationClaims(updatedTicket)) {
      this.denyRequest(updatedTicket);
    }

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
      return this.addDerivationResourceOwner(input, updatedTicket, {
        access_token: token,
        token_type: tokenType,
      });
    }

    // ... on failure, deny if no solvable requirements
    this.denyRequest(ticket);
  }

  // TODO:
  protected denyRequest(ticket: Ticket): never {
    if (ticket.required_claims && !this.hasRequiredDerivationClaims(ticket)) {
      const id = randomUUID();
      this.ticketStore.set(id, ticket);
      throw new NeedInfoError('Need upstream derivation access token claims to authorize request ...', id, {
        required_claims: ticket.required_claims.filter((requirement) =>
          ticket.provided[derivationRequirementKey(requirement)] !== true),
      });
    }

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
      return this.addDerivationRequirements(stored);
    }

    if (!permissions) {
      this.error(BadRequestHttpError, 'A token request without existing ticket should include requested permissions.');
    }

    return this.addDerivationRequirements(await this.ticketingStrategy.initializeTicket(permissions));
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

      const claims = format === ACCESS_TOKEN_CLAIM_FORMAT ?
        await this.verifyDerivationAccessTokens(token, ticket.required_claims ?? []) :
        await this.verifier.verify({ token, format });

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

  protected async addDerivationResourceOwner(
    input: DialogInput,
    ticket: Ticket,
    output: DialogOutput,
  ): Promise<DialogOutput> {
    if (!hasScope(input.scope, DERIVATION_CREATION_SCOPE)) {
      return output;
    }

    return {
      ...output,
      derivation_resource_owner: await this.getDerivationResourceOwner(ticket),
    };
  }

  protected async getDerivationResourceOwner(ticket: Ticket): Promise<string> {
    if (!this.registrationStore) {
      this.error(BadRequestHttpError, 'Cannot create a derivation resource without a registration store.');
    }

    const owners = new Set<string>();
    for (const permission of ticket.permissions) {
      const registration = await this.registrationStore.get(permission.resource_id);
      if (!registration) {
        this.error(BadRequestHttpError, `Unknown UMA ID ${permission.resource_id}`);
      }
      owners.add(registration.owner);
    }

    if (owners.size === 0) {
      this.error(BadRequestHttpError, 'Cannot create a derivation resource without requested permissions.');
    }
    if (owners.size > 1) {
      this.error(BadRequestHttpError, 'Cannot bind one derivation resource to multiple resource owners.');
    }

    return owners.values().next().value!;
  }

  protected async addDerivationRequirements(ticket: Ticket): Promise<Ticket> {
    if (!this.registrationStore) {
      return ticket;
    }

    const requiredClaims: DerivationRequiredClaim[] = [];
    for (const permission of ticket.permissions) {
      const registration = await this.registrationStore.get(permission.resource_id);
      for (const derivedFrom of registration?.description.derived_from ?? []) {
        requiredClaims.push({
          claim_type: DERIVATION_ACCESS_CLAIM_TYPE,
          claim_token_format: ACCESS_TOKEN_CLAIM_FORMAT,
          issuer: derivedFrom.issuer,
          derivation_resource_id: derivedFrom.derivation_resource_id,
          resource_scopes: permission.resource_scopes,
        });
      }
    }

    if (requiredClaims.length === 0) {
      return ticket;
    }

    ticket.required_claims = requiredClaims;
    const requirementKeys = Object.fromEntries(requiredClaims.map((requirement) => [
      derivationRequirementKey(requirement),
      async (value: unknown): Promise<boolean> => value === true,
    ]));
    ticket.required = ticket.required.length > 0 ?
      ticket.required.map((requirements) => ({ ...requirements, ...requirementKeys })) :
      [ requirementKeys ];

    return ticket;
  }

  protected hasRequiredDerivationClaims(ticket: Ticket): boolean {
    return !ticket.required_claims?.some((requirement) => ticket.provided[derivationRequirementKey(requirement)] !== true);
  }

  protected async verifyDerivationAccessTokens(
    claimToken: string,
    requiredClaims: DerivationRequiredClaim[],
  ): Promise<ClaimSet> {
    const claims: ClaimSet = {};
    for (const token of this.parseClaimTokens(claimToken)) {
      const payload = await this.verifyJwtAccessToken(token);
      for (const requirement of requiredClaims) {
        if (payload.iss === requirement.issuer && this.hasPermission(payload, requirement)) {
          claims[derivationRequirementKey(requirement)] = true;
        }
      }
    }
    return claims;
  }

  protected parseClaimTokens(claimToken: string): string[] {
    try {
      const parsed = JSON.parse(claimToken) as unknown;
      if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) {
        return parsed;
      }
    } catch {
      // A single access token is the normal UMA claim_token representation.
    }
    return [ claimToken ];
  }

  protected async verifyJwtAccessToken(token: string): Promise<JWTPayload> {
    const payload = decodeJwt(token);
    if (typeof payload.iss !== 'string') {
      throw new BadRequestHttpError('Derivation access token is missing an issuer.');
    }

    const configUrl = joinUrl(payload.iss, '/.well-known/uma2-configuration');
    const configResponse = await fetch(configUrl);
    if (!configResponse.ok) {
      throw new BadRequestHttpError(`Could not fetch UMA configuration from ${configUrl}.`);
    }

    const config = await configResponse.json() as { jwks_uri?: string };
    if (!config.jwks_uri) {
      throw new BadRequestHttpError(`Missing jwks_uri from ${configUrl}.`);
    }

    try {
      const jwkSet = createRemoteJWKSet(new URL(config.jwks_uri, configUrl));
      const verified = await jwtVerify(token, jwkSet);
      return verified.payload;
    } catch (error: unknown) {
      throw new BadRequestHttpError(`Invalid derivation access token: ${createErrorMessage(error)}`);
    }
  }

  protected hasPermission(payload: JWTPayload, requirement: DerivationRequiredClaim): boolean {
    const permissions = payload.permissions;
    if (!Array.isArray(permissions)) {
      return false;
    }

    return permissions.some((permission): boolean => {
      if (!permission || typeof permission !== 'object') {
        return false;
      }
      const entry = permission as { resource_id?: unknown, resource_scopes?: unknown };
      if (entry.resource_id !== requirement.derivation_resource_id || !Array.isArray(entry.resource_scopes)) {
        return false;
      }
      const resourceScopes = entry.resource_scopes as unknown[];
      return requirement.resource_scopes.every((scope) => resourceScopes.includes(scope));
    });
  }
}
