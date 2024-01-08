import { Permission } from './Permission';
import { Type, any, array, string } from "../util/ReType";

export const Ticket = {
  id: string,
  requestedPermissions: array(Permission),
  necessaryGrants: array(any),
};

export type Ticket = Type<typeof Ticket>;
