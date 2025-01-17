import { Type, string, array, optional as $, unknown } from "../util/ReType";
import { Permission } from "../views/Permission";

// Setup for multiple claims in the future

// /**
//  * A ReType constant for {@link ClaimTokenInput:type}.
//  */
// export const ClaimTokenInput = ({
//   claim_token: $(string),
//   claim_token_format: $(string), // TODO: switch to array of claims objects with unknown structure
// })

// /**
//  * A ReType constant for {@link DialogInput:type}.
//  */
// export const DialogInput = ({
//   ticket: $(string),
//   claims: $(array(ClaimTokenInput)),
//   pct: $(string),
//   rpt: $(string),
//   permissions: $(array(Permission)), // this deviates from UMA, which only has a 'scope' string-array
// });


/**
 * A ReType constant for {@link DialogInput:type}.
 */
export const DialogInput = ({
  ticket: $(string),
  claim_token: $(string),
  claim_token_format: $(string), // TODO: switch to array of claims objects with unknown structure
  pct: $(string),
  rpt: $(string),
  permissions: $(array(Permission)), // this deviates from UMA, which only has a 'scope' string-array
});

/**
 * The input for a dialog.
 */
export type DialogInput = Type<typeof DialogInput>;
