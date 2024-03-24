import { Type, array, optional as $, string } from "../util/ReType";
import { ScopeDescription } from "./ScopeDescription";

export const ResourceDescription = {
  resource_scopes: array(string),
  type: $(string),
  name: $(string),
  icon_uri: $(string),
  description: $(string),
};

export type ResourceDescription = Type<typeof ResourceDescription>;
