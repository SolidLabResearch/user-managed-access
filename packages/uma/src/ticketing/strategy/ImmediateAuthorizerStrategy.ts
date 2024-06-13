import { ClaimSet } from "../../credentials/ClaimSet";
import { Ticket } from "../Ticket";
import { Permission } from "../../views/Permission";
import { Failure, Result, Success } from "../../util/Result";
import { TicketingStrategy } from "./TicketingStrategy";
import { Authorizer } from "../../policies/authorizers/Authorizer";
import { getLoggerFor } from "../../util/logging/LoggerUtils";
import { Logger } from "../../util/logging/Logger";
import type { Requirements } from "../../credentials/Requirements";

/**
 * A TicketingStrategy that simply stores provided Claims, and calculates all
 * available Permissions from them upon resolution.
 */
export class ImmediateAuthorizerStrategy implements TicketingStrategy {
  protected readonly logger: Logger = getLoggerFor(this);

  constructor(
    private authorizer: Authorizer,
  ) {}

  /** @inheritdoc */
  async initializeTicket(permissions: Permission[]): Promise<Ticket> {
    this.logger.info('Initializing ticket.', permissions)

    return ({
      permissions,
      required: [{}],
      provided: {}
    });
  }

  /** @inheritdoc */
  async validateClaims(ticket: Ticket, claims: ClaimSet): Promise<Ticket> {
    this.logger.info('Validating claims.', { ticket, claims });
    
    for (const key of Object.keys(claims)) {
      ticket.provided[key] = claims[key];
    }

    return ticket;
  }

  /** @inheritdoc */
  async resolveTicket(ticket: Ticket): Promise<Result<Permission[], Requirements[]>> {
    this.logger.info('Resolving ticket.', ticket);

    const permissions = await this.calculatePermissions(ticket);

    if (permissions.length === 0) return Failure([]);

    return Success(permissions);
  }

  private async calculatePermissions(ticket: Ticket): Promise<Permission[]> {
    return (await this.authorizer.permissions(ticket.provided, ticket.permissions)).filter(
      permission => permission.resource_scopes.length > 0
    );
  }
}
