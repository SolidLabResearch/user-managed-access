import {Logger} from '../util/logging/Logger';
import {getLoggerFor} from '../util/logging/LoggerUtils';
import {Authorizer} from './Authorizer';
import {Principal} from '../models/AccessToken';
import {Ticket} from '../models/Ticket';
import {Permission} from '../models/Permission';

/**
 * Mock authorizer granting only granting public access to resources in '/public/'.
 */
export class PublicNamespaceAuthorizer extends Authorizer {
  protected readonly logger: Logger = getLoggerFor(this);

  /**
   *
   */
  constructor(
    protected authorizer: Authorizer,
    protected namespaces: string[] = [ 'profile', 'public' ],
  ) {
    super();
  }

  /**
   * Authorizes the client for specified request
   * @param {Principal} client - authenticated client
   * @param {Ticket} request - request to be authorized
   * @return {Promise<Permission[]>} - granted access modes
   */
  public async authorize(ticket: Ticket, client?: Principal): Promise<Ticket> {
    const nss = ticket.requestedPermissions.map(
      permission => new URL(permission.resource_id).pathname.split('/')?.[2] ?? ''
    )
    
    this.logger.info(`Authorizing resources in namespaces: ${JSON.stringify(nss)}`);

    if (nss.every(ns => this.namespaces.includes(ns))) {
      this.logger.info('Only access to public resources requested.');

      return { ...ticket, necessaryGrants: [] };
    }

    this.logger.info('Access to private resources requested. Leaving processing to authorizer.');

    return  this.authorizer.authorize(ticket, client);
  }
}
