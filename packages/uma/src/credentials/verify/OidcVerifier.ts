import { createSolidTokenVerifier } from '@solid/access-token-verifier';
import { BadRequestHttpError } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { createRemoteJWKSet, decodeJwt, JWTPayload, jwtVerify, JWTVerifyOptions } from 'jose';
import { CLIENTID, WEBID } from '../Claims';
import { ClaimSet } from '../ClaimSet';
import { Credential } from '../Credential';
import { OIDC } from '../Formats';
import { Verifier } from './Verifier';

/**
 * A Verifier for OIDC ID Tokens.
 *
 * The `allowedIssuers` list can be used to only allow tokens from these issuers.
 * Default is an empty list, which allows all issuers.
 */
export class OidcVerifier implements Verifier {
  protected readonly logger = getLoggerFor(this);

  private readonly verifyToken = createSolidTokenVerifier();

  public constructor(
    protected readonly baseUrl: string,
    protected readonly allowedIssuers: string[] = [],
    protected readonly verifyOptions: Record<string, unknown> = {},
  ) {}

  /** @inheritdoc */
  public async verify(credential: Credential): Promise<ClaimSet> {
    this.logger.debug(`Verifying credential ${JSON.stringify(credential)}`);
    if (credential.format !== OIDC) {
      throw new BadRequestHttpError(`Token format ${credential.format} does not match this processor's format.`);
    }

    // We first need to determine if this is a Solid OIDC token or a standard one
    const unsafeDecoded = decodeJwt(credential.token);
    const isSolidTOken = Array.isArray(unsafeDecoded.aud) && unsafeDecoded.aud.includes('solid');

    try {
      this.validateToken(unsafeDecoded);
      if (isSolidTOken) {
        return await this.verifySolidToken(credential.token);
      } else {
        return await this.verifyStandardToken(credential.token, unsafeDecoded.iss!);
      }
    } catch (error: unknown) {
      const message = `Error verifying OIDC ID Token: ${(error as Error).message}`;

      this.logger.debug(message);
      throw new BadRequestHttpError(message);
    }
  }

  protected validateToken(payload: JWTPayload): void {
    if (payload.aud !== this.baseUrl && !(Array.isArray(payload.aud) && payload.aud.includes(this.baseUrl))) {
      throw new BadRequestHttpError('This server is not valid audience for the token');
    }
    if (!payload.iss || this.allowedIssuers.length > 0 && !this.allowedIssuers.includes(payload.iss)) {
      throw new BadRequestHttpError('Unsupported issuer');
    }
  }

  protected async verifySolidToken(token: string): Promise<{ [WEBID]: string, [CLIENTID]?: string }> {
    const claims = await this.verifyToken(`Bearer ${token}`);

    this.logger.info(`Authenticated via a Solid OIDC. ${JSON.stringify(claims)}`);

    return ({
      // TODO: would have to use different value than "WEBID"
      // TODO: still want to use WEBID as external value potentially?
      [WEBID]: claims.webid,
      ...claims.client_id && { [CLIENTID]: claims.client_id }
    });
  }

  protected async verifyStandardToken(token: string, issuer: string):
    Promise<{ [WEBID]: string, [CLIENTID]?: string }> {
    const jwkSet = createRemoteJWKSet(new URL(issuer));
    const decoded = await jwtVerify(token, jwkSet, this.verifyOptions);
    if (!decoded.payload.sub) {
      throw new BadRequestHttpError('Invalid OIDC token: missing `sub` claim');
    }
    const client = decoded.payload.azp as string | undefined;
    return ({
      [WEBID]: decoded.payload.sub,
      ...client && { [CLIENTID]: client }
    });
  }
}
