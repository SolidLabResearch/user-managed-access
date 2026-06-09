import { Permission } from '../views/Permission';
import { ODRLContract } from '../views/Contract';
import { Type, array, optional as $, string, intersection, optional } from "../util/ReType";

export const AccessToken = {
  permissions: array(Permission),
  sub: optional(string),
  contract: optional(ODRLContract)
}

export type AccessToken = Type<typeof AccessToken>;
