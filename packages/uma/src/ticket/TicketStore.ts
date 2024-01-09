import { v4 } from "uuid";
import { Ticket } from "../models/Ticket";
import { KeyValueStore } from '../util/storage/models/KeyValueStore';
import { Permission } from "../models/Permission";

/**
 * A TicketStore is responsible for initializing and keeping track of Tickets.
 */
export abstract class TicketStore {

  protected abstract store: KeyValueStore<string, Ticket>;
  protected abstract initializeTicket(ticket: Ticket): Promise<Ticket>;

  public async get(ticketId: string): Promise<Ticket | undefined> {
    return this.store.get(ticketId);
  }

  public async create(requestedPermissions: Permission[]): Promise<Ticket> {
    const id = v4();
    
    const necessaryGrants: any[] = [];
    const ticket = { id, requestedPermissions, necessaryGrants };
    
    this.store.set(id, await this.initializeTicket(ticket));

    return ticket;
  }
}
