import {Logger} from '../util/logging/Logger';
import {getLoggerFor} from '../util/logging/LoggerUtils';
import {Authorizer} from './Authorizer';
import {Principal} from '../models/AccessToken';
import {Ticket} from '../models/Ticket';
import {Permission} from '../models/Permission';

/**
 * Mock authorizer granting all specified access modes
 * to any client.
 *
 * NOTE: DO NOT USE THIS IN PRODUCTION
 */
export class AllAuthorizer extends Authorizer {
  protected readonly logger: Logger = getLoggerFor(this);

  /**
   *
   */
  constructor() {
    super();
    this.logger.warn(`The AllAuthorizer was enabled. DO NOT USE THIS IN PRODUCTION!`);
  }

  /**
   * Authorizes the client for specified request
   * @param {Principal} client - authenticated client
   * @param {Ticket} request - request to be authorized
   * @return {Promise<Permission[]>} - granted access modes
   */
  public async authorize(ticket: Ticket, client?: Principal): Promise<Ticket> {
    return ticket;
  }
}
