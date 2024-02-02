import { Type, boolean, number, string, optional as $} from "../util/ReType";

/**
 * A ReType constant for {@link DialogOutput:type}.
 */
export const DialogOutput = ({
  access_token: string,
  refresh_token: $(string),
  token_type: string,
  expires_in: $(number),
  upgraded: $(boolean),
});

/**
 * The output for a dialog.
 */
export type DialogOutput = Type<typeof DialogOutput>;