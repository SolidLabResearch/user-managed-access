import { Type, optional as $, string } from "../util/ReType";

export const ScopeDescription = {  
  description: $(string),
  icon_uri: $(string),
  name: $(string),
};

export type ScopeDescription = Type<typeof ScopeDescription>;
