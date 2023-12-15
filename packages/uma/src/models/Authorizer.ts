import { Ticket } from './Ticket';
import { Principal } from './AccessToken';
import { Permission } from './Permission';

export abstract class Authorizer {
  public abstract authorize(client: Principal, request: Ticket): Promise<Permission[]>;
}
