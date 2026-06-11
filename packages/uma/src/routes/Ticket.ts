import {
  BadRequestHttpError,
  createErrorMessage,
  KeyValueStorage,
  UnauthorizedHttpError
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { randomUUID } from 'node:crypto';
import {
  ACCESS_TOKEN_CLAIM_FORMAT,
  DERIVATION_ACCESS_CLAIM_TYPE,
  DerivationRequiredClaim,
  derivationRequirementKey,
} from '../derivation/Derivation';
import { TicketingStrategy } from '../ticketing/strategy/TicketingStrategy';
import { Ticket } from '../ticketing/Ticket';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';
import { RequestValidator } from '../util/http/validate/RequestValidator';
import { RegistrationStore } from '../util/RegistrationStore';
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
    protected readonly registrationStore: RegistrationStore,
    protected readonly validator: RequestValidator,
  ) {
    super();
  }

  async handle({request}: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    this.logger.info(`Received permission registration request.`);
    await this.validator.handleSafe({ request });

    try {
      reType(request.body, array(Permission));
    } catch (e) {
      this.logger.warn(`Syntax error: ${createErrorMessage(e)}, ${request.body}`);
      throw new BadRequestHttpError(`Request has bad syntax: ${createErrorMessage(e)}`);
    }

    for (const { resource_id } of request.body) {
      // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-federated-authz-2.0.html#rfc.section.4.3
      if (!await this.registrationStore.has(resource_id)) {
        return {
          status: 400,
          body: {
            error: 'invalid_resource_id',
            error_description: `Unknown UMA ID ${resource_id}`,
          }
        }
      }
    }

    const ticket = await this.addDerivationRequirements(await this.ticketingStrategy.initializeTicket(request.body));
    if (ticket.required_claims?.some((requirement) => ticket.provided[derivationRequirementKey(requirement)] !== true)) {
      return this.storeTicket(ticket);
    }

    const resolved = await this.ticketingStrategy.resolveTicket(ticket);

    if (resolved.success) return { status: 200 };

    return this.storeTicket(ticket);
  }

  protected async storeTicket(ticket: Ticket): Promise<HttpHandlerResponse> {
    const id = randomUUID();
    await this.ticketStore.set(id, ticket);

    return {
      status: 201,
      body: { ticket: id },
    };
  }

  protected async addDerivationRequirements(ticket: Ticket): Promise<Ticket> {
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
}
