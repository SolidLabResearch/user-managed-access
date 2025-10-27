import { PURPOSE, WEBID } from '../../credentials/Claims';
import { ClaimSet } from "../../credentials/ClaimSet";
import { Ticket } from "../Ticket";
import { getLoggerFor } from 'global-logger-factory';
import { Permission } from "../../views/Permission";
import { Failure, Result, Success } from "../../util/Result";
import { TicketingStrategy } from "./TicketingStrategy";
import { Authorizer } from "../../policies/authorizers/Authorizer";
import type { Requirements } from "../../credentials/Requirements";

/**
 * A TicketingStrategy that simply stores provided Claims, and calculates all
 * available Permissions from them upon resolution.
 */
export class ImmediateAuthorizerStrategy implements TicketingStrategy {
  protected readonly logger = getLoggerFor(this);

  constructor(
    protected authorizer: Authorizer,
  ) {}

  /** @inheritdoc */
  public async initializeTicket(permissions: Permission[]): Promise<Ticket> {
    this.logger.info(`Initializing ticket. ${JSON.stringify(permissions)}`)

    return ({
      permissions,
      required: [{}],
      provided: {}
    });
  }

  /** @inheritdoc */
  public async validateClaims(ticket: Ticket, claims: ClaimSet): Promise<Ticket> {
    this.logger.info(`Validating claims. ${JSON.stringify({ ticket, claims })}`);

    for (const key of Object.keys(claims)) {
      ticket.provided[key] = claims[key];
    }

    return ticket;
  }

  /** @inheritdoc */
  public async resolveTicket(ticket: Ticket): Promise<Result<Permission[], Requirements[]>> {
    this.logger.info(`Resolving ticket. ${JSON.stringify(ticket)}`);

    const permissions = await this.calculatePermissions(ticket);

    if (permissions.length === 0) return Failure([]);

    return Success(permissions);
  }

  protected async calculatePermissions(ticket: Ticket): Promise<Permission[]> {
    // TODO: hardcoded mock for demo as I can't get Authorizer to work
    if (ticket.permissions.length === 1 &&
      ticket.permissions[0].resource_id.endsWith('/ruben/medical/smartwatch.ttl') &&
      ticket.permissions[0].resource_scopes.length === 1 &&
      ticket.permissions[0].resource_scopes[0] === 'urn:example:css:modes:read') {
      return (ticket.provided[PURPOSE] === 'urn:data:medical-research' &&
        ticket.provided[WEBID] === 'http://example.com/researcher/profile/card#me')? ticket.permissions : [];
    }

    if (ticket.permissions.length === 1 &&
      ticket.permissions[0].resource_id.endsWith('/ruben/medical/') &&
      ticket.permissions[0].resource_scopes.length === 1 &&
      ticket.permissions[0].resource_scopes[0] === 'urn:example:css:modes:read') {
      const permissions: Permission[] = [];
      if (ticket.provided[WEBID] === 'http://example.com/researcher/profile/card#me') {
        if (ticket.provided[PURPOSE] === 'urn:data:research' ||
          ticket.provided[PURPOSE] === 'urn:data:medical-research') {
          permissions.push({
            resource_id: ticket.permissions[0].resource_id + 'shared.ttl',
            resource_scopes: [ 'urn:example:css:modes:read' ],
          });
        }
        if (ticket.provided[PURPOSE] === 'urn:data:medical-research') {
          permissions.push({
            resource_id: ticket.permissions[0].resource_id + 'smartwatch.ttl',
            resource_scopes: [ 'urn:example:css:modes:read' ],
          });
        }
      }
      return permissions;
    }

    // TODO: authorizer should return required claims so these can be put into the ticket
    return (await this.authorizer.permissions(ticket.provided, ticket.permissions)).filter(
      permission => permission.resource_scopes.length > 0
    );
  }
}
