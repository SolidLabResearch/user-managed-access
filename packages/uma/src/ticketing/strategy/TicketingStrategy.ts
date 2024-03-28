import { ClaimSet } from "../../credentials/ClaimSet";
import { Ticket } from "../Ticket";
import { Permission } from "../../views/Permission";
import { Result } from "../../util/Result";
import type { Requirements } from "../../credentials/Requirements";

/**
 * A strategy interface for different actions on Tickets.
 */
export interface TicketingStrategy {

  /**
   * Initializes a Ticket based on requested Permissions.
   * 
   * Tickets should always be created using this function, as it enables initial
   * preprocessing of a new Ticket before starting its life cycle.
   * 
   * @param permissions - An Array of requested Permissions.
   * 
   * @returns A Ticket based on the requested Permissions.
   */
  initializeTicket(permissions: Permission[]): Promise<Ticket>;

  /**
   * Validates Claims in the context of a Ticket.
   * 
   * This function should be called whenever (new) Claims are presented for
   * resolving a Ticket. 
   * 
   * @param ticket - The Ticket for which to validate the Claims.
   * @param claims - The set of Claims to validate.
   * 
   * @returns An upgraded Ticket in which the Claims have been validated.
   */
  validateClaims(ticket: Ticket, claims: ClaimSet): Promise<Ticket>;

  /**
   * Resolves a Ticket.
   * 
   * This function can be used to check whether a Ticket can be resolved. If
   * so, it should return a list of Permissions; otherwise, it should return
   * the list of Claims that still have to be presented.
   * 
   * @param ticket - The Ticket to resolve.
   * 
   * @returns A Result with an Array of Permissions as Success value, or an
   * Dict of Claim descriptions as Failure value.
   */
  resolveTicket(ticket: Ticket): Promise<Result<Permission[], Requirements[]>>;
}
