import { ClaimSet } from "../ClaimSet";
import { Credential } from "../Credential";

/**
 * A Verifier verifies Credentials, extracting their Claims.
 */
export interface Verifier {

  /**
   * Verifies the given Credential.
   * 
   * @param credential - The Credential to verify.
   * @returns The claims asserted by the Credential
   */
  verify(credential: Credential): Promise<ClaimSet>;
}
