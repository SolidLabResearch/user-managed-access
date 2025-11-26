import { joinUrl } from '@solid/community-server';
import { isIri } from '../../util/ConvertUtil';
import { CLIENTID, WEBID } from '../Claims';
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
    return {
      ...claims,
      ...typeof claims[WEBID] === 'string' ? { [WEBID]: this.toIri(claims[WEBID]) } : {},
      ...typeof claims[CLIENTID] === 'string' ? { [CLIENTID]: this.toIri(claims[CLIENTID]) } : {},
    };
  }

  protected toIri(value: string): string {
    if (isIri(value)) {
      return value;
    }
    return joinUrl(this.baseUrl, encodeURIComponent(value));
  }
}
