import { createSolidTokenVerifier } from '@solid/access-token-verifier';
import {
  BadRequestHttpError,
  ForbiddenHttpError,
  InternalServerError,
  joinUrl,
  KeyValueStorage
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { createRemoteJWKSet, decodeJwt, JWTPayload, jwtVerify } from 'jose';
import { AccessToken } from '../../tokens/AccessToken';
import { UMA_SCOPES } from '../../ucp/util/Vocabularies';
import { reType } from '../../util/ReType';
import { Permission } from '../../views/Permission';
import { ACCESS, CLIENTID, WEBID } from '../Claims';
import { ClaimSet } from '../ClaimSet';
import { Credential } from '../Credential';
import { ACCESS_TOKEN, OIDC } from '../Formats';
import { Verifier } from './Verifier';

/**
 * A Verifier for OIDC Tokens.
 *
 * The `allowedIssuers` list can be used to only allow tokens from these issuers.
 * Default is an empty list, which allows all issuers.
 */
export class OidcVerifier implements Verifier {
  protected readonly logger = getLoggerFor(this);

  private readonly verifyToken = createSolidTokenVerifier();

  public constructor(
    protected readonly baseUrl: string,
    protected readonly derivationStore: KeyValueStorage<string, string>,
    protected readonly allowedIssuers: string[] = [],
    protected readonly verifyOptions: Record<string, unknown> = {},
  ) {}

  /** @inheritdoc */
  public async verify(credential: Credential): Promise<ClaimSet> {
    this.logger.debug(`Verifying credential ${JSON.stringify(credential)}`);
    if (credential.format !== OIDC && credential.format !== ACCESS_TOKEN) {
      throw new BadRequestHttpError(`Token format ${credential.format} does not match this processor's format.`);
    }

    // We first need to determine if this is a Solid OIDC token or a standard one
    const unsafeDecoded = decodeJwt(credential.token);
    const isSolidToken = (unsafeDecoded.aud === 'solid' ||
      (Array.isArray(unsafeDecoded.aud) && unsafeDecoded.aud.includes('solid')))
      && typeof unsafeDecoded.webid === 'string';

    try {
      this.validateToken(unsafeDecoded);
      if (isSolidToken) {
        return await this.verifySolidToken(credential.token);
      } else {
        return await this.verifyStandardToken(credential.token, credential.format, unsafeDecoded.iss!);
      }
    } catch (error: unknown) {
      const message = `Error verifying OIDC Token: ${(error as Error).message}`;

      this.logger.debug(message);
      throw new BadRequestHttpError(message);
    }
  }

  protected validateToken(payload: JWTPayload): void {
    // TODO: disable audience check for now, need to investigate required values further
    // if (payload.aud !== this.baseUrl && !(Array.isArray(payload.aud) && payload.aud.includes(this.baseUrl))) {
    //   throw new BadRequestHttpError('This server is not valid audience for the token');
    // }
    if (!payload.iss || this.allowedIssuers.length > 0 && !this.allowedIssuers.includes(payload.iss)) {
      throw new BadRequestHttpError('Unsupported issuer');
    }
  }

  protected async verifySolidToken(token: string): Promise<{ [WEBID]: string, [CLIENTID]?: string }> {
    const claims = await this.verifyToken(`Bearer ${token}`);
    // Depends on the spec version which field to use
    const clientId = (claims as { azp?: string }).azp ?? claims.client_id;

    this.logger.info(`Authenticated via a Solid OIDC. ${JSON.stringify(claims)}`);

    return ({
      // TODO: would have to use different value than "WEBID"
      // TODO: still want to use WEBID as external value potentially?
      [WEBID]: claims.webid,
      ...clientId && { [CLIENTID]: clientId }
    });
  }

  protected async verifyStandardToken(token: string, format: string, issuer: string):
    Promise<{ [WEBID]?: string, [CLIENTID]?: string, [ACCESS]?: Permission[] }> {
    const configUrl = joinUrl(issuer, '/.well-known/openid-configuration');
    const configResponse = await fetch(configUrl);
    if (configResponse.status !== 200) {
      throw new BadRequestHttpError(`Unable to access ${configUrl}`);
    }
    const config = await configResponse.json() as { jwks_uri?: string };
    if (!config.jwks_uri) {
      throw new BadRequestHttpError(`Missing jwks_uri from ${configUrl}`);
    }
    const jwkSet = createRemoteJWKSet(new URL(config.jwks_uri));
    const decoded = await jwtVerify(token, jwkSet, this.verifyOptions);

    if (format === OIDC) {
      if (!decoded.payload.sub) {
        throw new BadRequestHttpError('Invalid OIDC ID token: missing `sub` claim');
      }
      const client = decoded.payload.azp as string | undefined;
      return {
        [WEBID]: decoded.payload.sub,
        ...client && { [CLIENTID]: client }
      };
    } else if (format === ACCESS_TOKEN) {
      const iss = decoded.payload.iss;
      // TODO: generalize this so the derivation-read specifics are not in this class
      reType(decoded.payload, AccessToken);
      const permissions: Permission[] = [];
      for (const { resource_id: id, resource_scopes: scopes } of decoded.payload.permissions) {
        // Need to make sure the token was issued by the corresponding issuer
        if (scopes.includes(UMA_SCOPES['derivation-read'])) {
          const issuer = await this.derivationStore.get(id);
          if (!issuer) {
            this.logger.warn(`Received access token for unknown aggregated id ${id}, ignoring permissions.`);
          }
          if (issuer !== iss) {
            this.logger.warn(`Received access token for aggregated id ${id} with wrong issuer: ${iss
            } instead of ${issuer}, rejection request.`);
            throw new ForbiddenHttpError(`Invalid issuer for ${id}, expected ${issuer} but got ${iss}`);
          }
          permissions.push({ resource_id: id, resource_scopes: [ UMA_SCOPES['derivation-read']] });
        } else {
          // TODO: we could just accept the access permissions here, but this could potentially be unsafe
          this.logger.warn(`Received unexpected permissions in access token: ${scopes}`);
        }
      }
      return {
        [ACCESS]: permissions,
      }
    }
    throw new InternalServerError(`Unsupported claim format ${format}`);
  }
}
