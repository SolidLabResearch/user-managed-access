import { ClaimSet } from "../../credentials/ClaimSet";
import { RequiredClaim } from '../../errors/NeedInfoError';
import { Ticket } from "../Ticket";
import { getLoggerFor } from 'global-logger-factory';
import { Permission } from "../../views/Permission";
import { Failure, Result, Success } from "../../util/Result";
import { TicketingStrategy } from "./TicketingStrategy";
import { Authorizer } from "../../policies/authorizers/Authorizer";

/**
 * A TicketingStrategy that simply stores provided Claims, and calculates all
 * available Permissions from them upon resolution.
 *
 * If `allowPartialSuccess` is set to true,
 * the strategy will return all available permissions,
 * even if not all required permissions are granted.
 */
export class ImmediateAuthorizerStrategy implements TicketingStrategy {
  protected readonly logger = getLoggerFor(this);

  constructor(
    protected authorizer: Authorizer,
    protected readonly allowPartialSuccess = false,
  ) {}

  /** @inheritdoc */
  public async initializeTicket(permissions: Permission[]): Promise<Ticket> {
    this.logger.info(`Initializing ticket. ${JSON.stringify(permissions)}`)

    return {
      permissions,
      provided: {}
    };
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
  public async resolveTicket(ticket: Ticket): Promise<Result<Permission[], RequiredClaim[]>> {
    this.logger.info(`Resolving ticket. ${JSON.stringify(ticket)}`);

    const permissions = await this.calculatePermissions(ticket);

    // Always fail if no results at all, even with allowPartialSuccess
    if (permissions.length === 0) return Failure([]);

    // With partial success enabled, any non-empty authorization result is accepted
    if (this.allowPartialSuccess) return Success(permissions);

    // Verify all required scopes have been granted
    const unmatchedPermissions: Permission[] = [];
    for (const required of ticket.permissions) {
      const scopeMatch = Object.fromEntries(required.resource_scopes.map((scope) => [ scope, false ]));
      for (const result of permissions) {
        if (required.resource_id !== result.resource_id) {
          continue;
        }
        for (const scope of result.resource_scopes) {
          scopeMatch[scope] = true;
        }
      }
      const unmatchedScopes = Object.keys(scopeMatch).filter((scope) => !scopeMatch[scope]);
      if (unmatchedScopes.length > 0) {
        unmatchedPermissions.push({ resource_id: required.resource_id, resource_scopes: unmatchedScopes });
      }
    }

    if (unmatchedPermissions.length > 0) {
      // TODO: RequiredClaim has no field indicating for which the scopes are missing, could add one.
      //       The resource_scopes field itself is already custom (added because of aggregation spec)
      return Failure(unmatchedPermissions.map((perm) => ({ resource_scopes: perm.resource_scopes })));
    }

    return Success(permissions);
  }

  protected async calculatePermissions(ticket: Ticket): Promise<Permission[]> {
    return (await this.authorizer.permissions(ticket.provided, ticket.permissions)).filter(
      permission => permission.resource_scopes.length > 0
    );
  }
}
