import { ClaimSet } from '../credentials/ClaimSet';
import { Permission } from '../views/Permission';

export interface Ticket {
  // These are identifiers that were not originally part of the request
  // but got included because other identifiers require them.
  derivedIds?: string[],
  permissions: Permission[],
  provided: ClaimSet,
}
