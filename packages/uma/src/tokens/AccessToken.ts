import { Permission } from '../views/Permission';
import { Contract } from '../views/Contract';
import { Type, array, optional as $, string, intersection, optional } from "../util/ReType";

export const AccessToken = {
  permissions: array(Permission),
  contract: optional(Contract)
}

export type AccessToken = Type<typeof AccessToken>;

