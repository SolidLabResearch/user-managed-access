import { Ticket } from './Ticket';
import { Principal } from './AccessToken';
import { Permission } from './Permission';
import { Logger } from '../logging/Logger';

export abstract class Authorizer {
  public abstract authorize(client: Principal, request: Ticket): Promise<Permission[]>;
}
