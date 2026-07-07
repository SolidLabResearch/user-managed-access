import { ClaimSet } from '../credentials/ClaimSet';
import { Permission } from '../views/Permission';

export interface RefreshTokenIssuer {
  issue(claims: ClaimSet, permissions: Permission[]): Promise<string>;
}
