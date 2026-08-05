import { BadRequestHttpError } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { decodeJwt, JWTPayload, jwtVerify } from 'jose';
import { getJwks } from '../../util/JwtUtil';
import { VC } from '../Claims';
import { ClaimSet } from '../ClaimSet';
import { Credential } from '../Credential';
import { VC_JWT } from '../Formats';
import { Verifier } from './Verifier';

// TODO:

// TODO: implementation probably based too much on current example format

/**
 * A Verifier for VC Tokens.
 *
 * To only allow tokens from certain options, set `verifyOptions` to { issuer: [ 'http://example.com/' ] }.
 */
export class VcVerifier implements Verifier {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    protected readonly verifyOptions: Record<string, unknown> = {},
  ) {}

  public async verify(credential: Credential): Promise<ClaimSet> {
    this.logger.debug(`Verifying credential ${JSON.stringify(credential)}`);
    if (credential.format !== VC_JWT) {
      throw new BadRequestHttpError(`Token format ${credential.format} does not match this processor's format.`);
    }

    const unsafeDecoded = decodeJwt(credential.token);
    if (!unsafeDecoded.iss) {
      throw new BadRequestHttpError(`Token is missing the issuer claim.`);
    }

    const jwkSet = await getJwks(unsafeDecoded.iss);
    const decoded = await jwtVerify(credential.token, jwkSet, this.verifyOptions);

    return { [VC]: [ this.extractVcClaims(decoded.payload) ] };
  }

  protected extractVcClaims(payload: JWTPayload): Record<string, unknown> {
    if (!payload.vc || typeof payload.vc !== 'object') {
      throw new BadRequestHttpError(`Token is missing the vc claim.`);
    }

    const vc = payload.vc as Record<string, unknown>;
    if (typeof vc.issuanceDate === 'string' && new Date(vc.issuanceDate) > new Date()) {
      throw new BadRequestHttpError(`VC is not yet valid, issued at ${vc.issuanceDate}.`);
    }
    if (typeof vc.validFrom === 'string' && new Date(vc.validFrom) > new Date()) {
      throw new BadRequestHttpError(`VC is not yet valid, valid from ${vc.validFrom}.`);
    }

    if (typeof vc.expirationDate === 'string' && new Date(vc.expirationDate) < new Date()) {
      throw new BadRequestHttpError(`VC expired at ${vc.expirationDate}.`);
    }
    if (typeof vc.validUntil === 'string' && new Date(vc.validUntil) < new Date()) {
      throw new BadRequestHttpError(`VC expired at ${vc.validUntil}.`);
    }

    if (typeof vc.credentialSubject !== 'object') {
      throw new BadRequestHttpError(`VC is missing the credentialSubject claim.`);
    }

    this.logger.debug(`Validated VC claims ${JSON.stringify(payload)}`);

    return vc;
  }
}
