import { DialogInput } from "./Input";
import { DialogOutput } from "./Output";

/**
 * A Negotiator processes the token request.
 */
export interface Negotiator {
  negotiate(input: DialogInput): Promise<DialogOutput>;
}
