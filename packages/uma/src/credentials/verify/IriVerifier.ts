import { joinUrl } from '@solid/community-server';
import { isIri } from '../../util/ConvertUtil';
import { CLIENTID, ORIGINAL_CLIENTID, ORIGINAL_WEBID, WEBID } from '../Claims';
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
    for (const [ claimType, original ] of [[WEBID, ORIGINAL_WEBID], [CLIENTID, ORIGINAL_CLIENTID]]) {
      if (Array.isArray(claims[claimType])) {
        result[original] = [];
        for (let i = 0; i < claims[claimType].length; i += 1) {
          const entry = claims[claimType][i];
          result[original].push(entry);
          if (typeof entry === 'string' && !isIri(entry)) {
            result[claimType]![i] = joinUrl(this.baseUrl, encodeURIComponent(entry));
          }
        }
      }
    }

    return result;
  }
}
