import {Ticket} from './Ticket';
import {Principal} from './AccessToken';
import {Permission} from './Permission';

/**
 * An authorizer will determine, for some given request and client
 * what access modes it can authorize.
 */
export abstract class Authorizer {
    public abstract authorize(client: Principal, request: Ticket): Promise<Permission[]>;
}
