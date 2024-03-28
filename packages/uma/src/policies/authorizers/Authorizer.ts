import { Requirements } from '../../credentials/Requirements';
import { ClaimSet } from '../../credentials/ClaimSet';
import { ForbiddenHttpError } from '../../util/http/errors/ForbiddenHttpError';
import { Permission } from '../../views/Permission';

export const ANY_RESOURCE = 'urn:solidlab:uma:resources:any';
export const ANY_SCOPE = 'urn:solidlab:uma:scopes:any';

export abstract class Authorizer {

  /**
   * Calculates the available Permissions for a given set of Claims.
   * 
   * @param {ClaimSet} claims - The set of asserted Claims.
   * @param {Permission[]} query - An optional query to constrain the calculated
   * Permissions.
   * 
   * @return {Promise<Permission[]>} - An Array of available Permissions.
   */
  public abstract permissions(claims: ClaimSet, query?: Partial<Permission>[]): Promise<Permission[]>;

  /**
   * Calculates the required Credentials to achieve a set of given Permissions.
   * 
   * @param {Permissions[]} permissions - The requested Permissions.
   * @param {Requirements} query - An optional query to constrain the calculated Requirements.
   * 
   * @return {Promise<Requirements>} An object containing ClaimDescriptions.
   */
  public abstract credentials(permissions: Permission[], query?: Requirements): Promise<Requirements[]>;
  // TODO:
  // * @throws {ForbiddenHttpError} When no Credentials can be found (within the query limits)
  // * that would grant the requested Permissions.

}
