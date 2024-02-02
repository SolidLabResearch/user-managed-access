import { Type, array, string } from "../util/ReType";

export const Permission = {
    resource_id: string,
    resource_scopes: array(string),
};

export type Permission = Type<typeof Permission>;
