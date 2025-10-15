import { BadRequestHttpError, KeyValueStorage } from '@solid/community-server';
import { randomUUID } from 'crypto';
import { CLIENTID, WEBID } from '../credentials/Claims';
import { Verifier } from '../credentials/verify/Verifier';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';
import { reType, string, Type } from '../util/ReType';

export const PatInput = {
  claim_token: string,
  claim_token_format: string,
  scope: 'uma_protection',
};

export type PatInput = Type<typeof PatInput>;

export type PatEntry = { owner: string, rs: string };

/**
 * Generates a new PAT for the given WebID/RS combination
 */
export class PatHandler extends HttpHandler {
  public constructor(
    protected readonly verifier: Verifier,
    protected readonly storage: KeyValueStorage<string, PatEntry>,
  ){
    super();
  }

  public async handle(input: HttpHandlerContext): Promise<HttpHandlerResponse> {
    // TODO: might want to verify if there is not already a PAT for this WebID,
    //       this would require the PATs to be stored in a different data structure though
    reType(input.request.body, PatInput);
    const { claim_token: token, claim_token_format: format } = input.request.body;
    const claims = await this.verifier.verify({ token, format });
    const webId = claims[WEBID];
    // Using client ID for RS identifier, as in practice it is the RS that should be executing the request
    const clientId = claims[CLIENTID];
    if (typeof webId !== 'string' || typeof clientId !== 'string') {
      throw new BadRequestHttpError(`PAT request requires ${WEBID} and ${CLIENTID} claims.`);
    }
    const pat = randomUUID();
    await this.storage.set(pat, { owner: webId, rs: clientId })

    return {
      status: 201,
      body: { pat },
    }
  }
}
