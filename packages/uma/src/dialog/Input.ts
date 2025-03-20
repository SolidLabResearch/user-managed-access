import { Type, string, array, optional as $, unknown } from "../util/ReType";
import { ODRLPermission } from "../views/Contract";
import { Permission } from "../views/Permission";

/**
 * A ReType constant for {@link DialogInput:type}.
 */
export const DialogInput = ({
  "@context": $(string),
  grant_type: $(string),
  ticket: $(string),
  claim_token: $(string),
  claim_token_format: $(string), // TODO: switch to array of claims objects with unknown structure
  pct: $(string),
  rpt: $(string),
  permissions: $(array(Permission)), // this deviates from UMA, which only has a 'scope' string-array
  permission: $(array(ODRLPermission)), // this deviates from UMA, which only has a 'scope' string-array
});

/**
 * The input for a dialog.
 */
export type DialogInput = Type<typeof DialogInput>;
