import { Permission } from '../views/Permission';
import { ODRLContract } from '../views/Contract';
import { Type, array, optional, number, string } from "../util/ReType";

export const AccessToken = {
  permissions: array(Permission),
  contract: optional(ODRLContract),
  iss: optional(string),
  iat: optional(number),
  exp: optional(number),
  nbf: optional(number),
  issued_at: optional(number),
}

export type AccessToken = Type<typeof AccessToken>;
