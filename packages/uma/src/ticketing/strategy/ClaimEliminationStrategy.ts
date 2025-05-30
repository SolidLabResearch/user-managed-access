import { getLoggerFor } from '@solid/community-server';
import { ClaimSet } from "../../credentials/ClaimSet";
import { Ticket } from "../Ticket";
import { Permission } from "../../views/Permission";
import { Failure, Result, Success } from "../../util/Result";
import { TicketingStrategy } from "./TicketingStrategy";
import { Requirements } from "../../credentials/Requirements";
import { Authorizer } from "../../policies/authorizers/Authorizer";

/**
 * A TicketingStrategy that calculates all necessary Claims for a given Permissions
 * upon initialization if a Ticket, and eliminates those Claims upon validation.
 * When all necessary Claims are eliminated, the Ticket resolves to the initial
 * requested Permissions.
 */
export class ClaimEliminationStrategy implements TicketingStrategy {
  protected readonly logger = getLoggerFor(this);

  constructor(
    private authorizer: Authorizer,
  ) {}

  /** @inheritdoc */
  async initializeTicket(permissions: Permission[]): Promise<Ticket> {
    this.logger.info(`Initializing ticket. ${JSON.stringify(permissions)}`)

    return ({
      permissions,
      required: await this.calculateRequiredClaims(permissions),
      provided: {}
    });
  }

  private async calculateRequiredClaims(permissions: Permission[]): Promise<Requirements[]> {
    return this.authorizer.credentials(permissions);
  }

  /** @inheritdoc */
  async validateClaims(ticket: Ticket, claims: ClaimSet): Promise<Ticket> {
    this.logger.debug(`Validating claims. ${JSON.stringify({ ticket, claims })}`);

    for (const key of Object.keys(claims)) {
      ticket.provided[key] = claims[key];

      for (const requirements of ticket.required) {
        const requirement = requirements[key];

        if (requirement && await requirement(claims[key])) {
          delete requirements[key];
        }
      }
    }

    return ticket;
  }

  /** @inheritdoc {@link TicketingStrategy.resolveTicket} */
  async resolveTicket(ticket: Ticket): Promise<Result<Permission[], Requirements[]>> {
    this.logger.debug(`Resolving ticket. ${JSON.stringify(ticket)}`);

    return ticket.required.some(req => Object.keys(req).length === 0)
      ? Success(ticket.permissions)
      : Failure(ticket.required);
  }
}
