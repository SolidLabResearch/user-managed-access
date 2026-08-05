import { createSolidTokenVerifier } from '@solid/access-token-verifier';
import { BadRequestHttpError, ForbiddenHttpError, InternalServerError, KeyValueStorage } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { decodeJwt, jwtVerify } from 'jose';
import { AccessToken } from '../../tokens/AccessToken';
import { UMA_SCOPES } from '../../ucp/util/Vocabularies';
import { getJwks } from '../../util/JwtUtil';
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
 * To only allow tokens from certain issuers, set `verifyOptions` to { issuer: [ 'http://example.com/' ] }.
 */
export class OidcVerifier implements Verifier {
  protected readonly logger = getLoggerFor(this);

  private readonly verifyToken = createSolidTokenVerifier();

  public constructor(
    protected readonly derivationStore: KeyValueStorage<string, string>,
    protected readonly verifyOptions: Record<string, unknown> = {}, // JWTVerifyOptions
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

  protected async verifySolidToken(token: string): Promise<ClaimSet> {
    const claims = await this.verifyToken(`Bearer ${token}`);
    const issuers = this.verifyOptions.issuer;
    const allowedIssuers = issuers !== undefined && (typeof issuers === 'string' ? [issuers] : issuers as string[]);
    if (!claims.iss || (allowedIssuers && !allowedIssuers.includes(claims.iss))) {
      throw new BadRequestHttpError('Unsupported issuer');
    }
    // Depends on the spec version which field to use
    const clientId = (claims as { azp?: string }).azp ?? claims.client_id;

    this.logger.info(`Authenticated via a Solid OIDC. ${JSON.stringify(claims)}`);

    return ({
      // TODO: would have to use different value than "WEBID"
      // TODO: still want to use WEBID as external value potentially?
      [WEBID]: [ claims.webid ],
      ...clientId && { [CLIENTID]: [ clientId ] }
    });
  }

  protected async verifyStandardToken(token: string, format: string, issuer: string): Promise<ClaimSet> {
    const jwkSet = await getJwks(issuer);
    const decoded = await jwtVerify(token, jwkSet, this.verifyOptions);

    if (format === OIDC) {
      if (!decoded.payload.sub) {
        throw new BadRequestHttpError('Invalid OIDC ID token: missing `sub` claim');
      }
      const client = decoded.payload.azp as string | undefined;
      return {
        [WEBID]: [ decoded.payload.sub ],
        ...client && { [CLIENTID]: [ client ] }
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
