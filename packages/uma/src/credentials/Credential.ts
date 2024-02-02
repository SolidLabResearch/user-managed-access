import { Type, string } from '../util/ReType';

/**
 * A ReType constant for {@link Credential:type}.
 */
export const Credential = ({
  token: string,
  format: string,
})

/**
 * A Claim Token of a specified format.
 */
export type Credential = Type<typeof Credential>;
