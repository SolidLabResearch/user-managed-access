import { ClaimSet } from '../credentials/ClaimSet';
import { Permission } from '../views/Permission';

export interface Ticket {
  permissions: Permission[],
  provided: ClaimSet,
}
