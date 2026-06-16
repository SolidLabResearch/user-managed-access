import { joinUrl } from '@solid/community-server';
import { isIri } from '../../util/ConvertUtil';
import { CLIENTID, ORIGINAL, WEBID } from '../Claims';
import { ClaimSet } from '../ClaimSet';
import { Credential } from '../Credential';
import { Verifier } from './Verifier';

/**
 * Converts the user ID and client ID values to IRIs in case they are not already IRIs.
 */
export class IriVerifier implements Verifier {
  public constructor(
    protected readonly verifier: Verifier,
    protected readonly baseUrl: string,
  ) {}

  public async verify(credential: Credential): Promise<ClaimSet> {
    const claims = await this.verifier.verify(credential);
    const result = { ...claims };

    const original: Record<string, string> = {};
    for (const claim of [WEBID, CLIENTID]) {
      if (typeof claims[claim] === 'string' && !isIri(claims[claim])) {
        result[claim] = joinUrl(this.baseUrl, encodeURIComponent(claims[claim]));
        original[claim] = claims[claim];
      }
    }

    if (Object.keys(original).length > 0) {
      result[ORIGINAL] = original;
    }

    return result;
  }
}
