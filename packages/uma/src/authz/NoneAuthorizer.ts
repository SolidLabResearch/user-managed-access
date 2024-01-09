import {Logger} from '../util/logging/Logger';
import {getLoggerFor} from '../util/logging/LoggerUtils';
import {Authorizer} from './Authorizer';
import {Principal} from '../models/AccessToken';
import {Ticket} from '../models/Ticket';

const UNSOLVABLE_GRANT = Symbol('unsolvable-grant');

/**
 * Mock authorizer granting no access to any client.
 */
export class NoneAuthorizer extends Authorizer {
  protected readonly logger: Logger = getLoggerFor(this);

  /**
   * Authorizes the client for specified request
   * @param {Principal} client - authenticated client
   * @param {Ticket} request - request to be authorized
   * @return {Promise<Permission[]>} - granted access modes
   */
  public async authorize(ticket: Ticket, client?: Principal): Promise<Ticket> {
    ticket.necessaryGrants.push(UNSOLVABLE_GRANT);
    
    return ticket;
  }
}
