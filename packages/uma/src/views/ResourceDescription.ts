import { array, dict, intersection, optional as $, string, Type, union } from '../util/ReType';

export const ResourceDescription = {
  resource_scopes: array(string),
  resource_defaults: $(union({ '@reverse': dict(array(string)) }, dict(array(string)))),
  resource_relations: $(union({ '@reverse': dict(array(string)) }, dict(array(string)))),
  derived_from: $(array({ issuer: string, derivation_resource_id: string })),
  type: $(string),
  name: $(string),
  icon_uri: $(string),
  description: $(string),
};

export type ResourceDescription = Type<typeof ResourceDescription>;
