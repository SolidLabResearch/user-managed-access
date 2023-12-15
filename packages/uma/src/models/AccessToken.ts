import { Permission } from './Permission';
import { Type, array, optional as $, string, intersection } from "../util/ReType";

export const Authorization = {
  permissions: array(Permission),
}

export type Authorization = Type<typeof Authorization>;

export const Principal = {
  webId: string,
  clientId: $(string),
}

export type Principal = Type<typeof Principal>;

export const AccessToken = intersection(Principal, Authorization);

export type AccessToken = Type<typeof AccessToken>;
