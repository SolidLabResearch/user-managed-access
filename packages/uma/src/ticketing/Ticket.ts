import { ClaimSet } from '../credentials/ClaimSet';
import { Requirements } from '../credentials/Requirements';
import { DerivationRequiredClaim } from '../derivation/Derivation';
import { Permission } from '../views/Permission';

export interface Ticket {
  permissions: Permission[],
  required: Requirements[],
  provided: ClaimSet,
  required_claims?: DerivationRequiredClaim[],
}
