import { array, optional as $, string, Type } from '../util/ReType';

export const Permission = {
    resource_id: string,
    resource_scopes: array(string),
    policies: $(array(string)),
};

export type Permission = Type<typeof Permission>;
