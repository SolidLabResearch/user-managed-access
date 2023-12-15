import { Permission } from './Permission';
import { Type, array } from "../util/ReType";

export const Ticket = array(Permission);

export type Ticket = Type<typeof Ticket>;
