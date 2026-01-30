import { array, optional as $, string, Type, union } from '../util/ReType';
import { ODRLPermission } from '../views/Contract';
import { Permission } from '../views/Permission';

/**
 * A ReType constant for {@link DialogInput:type}.
 */
export const DialogInput = ({
  "@context": $(string),
  grant_type: $(string),
  ticket: $(string),
  // this deviates from UMA, which only has the singular token/format entry
  claim_token: $(union(string, array({ claim_token: $(string), claim_token_format: $(string) }))),
  claim_token_format: $(string),
  pct: $(string),
  rpt: $(string),
  permissions: $(array(Permission)), // this deviates from UMA, which only has a 'scope' string-array
  permission: $(array(ODRLPermission)), // this deviates from UMA, which only has a 'scope' string-array
  scope: $(string),
  refresh_token: $(string),
});

/**
 * The input for a dialog.
 */
export type DialogInput = Type<typeof DialogInput>;
