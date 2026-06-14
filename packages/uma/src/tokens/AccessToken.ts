import { Permission } from '../views/Permission';
import { ODRLContract } from '../views/Contract';
import { Type, array, optional, number } from "../util/ReType";

export const AccessToken = {
  permissions: array(Permission),
  contract: optional(ODRLContract),
  iat: optional(number),
  exp: optional(number),
  nbf: optional(number),
  issued_at: optional(number),
}

export type AccessToken = Type<typeof AccessToken>;
