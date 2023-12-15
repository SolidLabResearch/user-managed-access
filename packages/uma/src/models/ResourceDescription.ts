import { Type, array, optional as $, string } from "../util/ReType";
import { ScopeDescription } from "./ScopeDescription.js";

export const ResourceDescription = {
  resource_scopes: array(string),
  type: $(string),
  name: $(string),
  icon_uri: $(string),
  description: $(ScopeDescription),
};

export type ResourceDescription = Type<typeof ResourceDescription>;
