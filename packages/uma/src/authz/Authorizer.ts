import { Ticket } from '../models/Ticket';
import { Principal } from '../models/AccessToken';
import { Permission } from '../models/Permission';
import { Logger } from '../logging/Logger';

export abstract class Authorizer {
  public abstract authorize(ticket: Ticket, client?: Principal): Promise<Ticket>;
}
