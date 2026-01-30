import { ClaimSet } from '../../credentials/ClaimSet';
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
}
