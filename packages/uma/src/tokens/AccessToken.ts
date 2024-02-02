import { Permission } from '../views/Permission';
import { Type, array, optional as $, string, intersection } from "../util/ReType";

export const AccessToken = {
  permissions: array(Permission),
}

export type AccessToken = Type<typeof AccessToken>;

