import { ClaimSet } from '../credentials/ClaimSet';
import { Requirements } from '../credentials/Requirements';
import { Permission } from '../views/Permission';

export interface Ticket {
  permissions: Permission[],
  required: Requirements[],
  provided: ClaimSet,
};
