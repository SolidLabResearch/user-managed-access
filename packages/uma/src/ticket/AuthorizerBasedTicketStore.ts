import { v4 } from "uuid";
import { Ticket } from "../models/Ticket";
import { KeyValueStore } from '../storage/models/KeyValueStore';
import { Permission } from "../models/Permission";
import { TicketStore } from "./TicketStore";
import { Authorizer } from "../authz/Authorizer";

/**
 * A TicketStore is responsible for initializing and keeping track of Tickets.
 */
export class AuthorizerBasedTicketStore extends TicketStore{

  constructor(
    protected store: KeyValueStore<string, Ticket>,
    protected authorizer: Authorizer,
  ) {
    super();
  }

  protected async initializeTicket(ticket: Ticket): Promise<Ticket> {
    return this.authorizer.authorize(ticket);
  }
}
