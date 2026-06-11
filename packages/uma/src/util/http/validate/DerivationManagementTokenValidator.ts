import {
  ForbiddenHttpError,
  JwkGenerator,
  UnauthorizedHttpError
} from '@solid/community-server';
import { importJWK, JWTPayload, jwtVerify } from 'jose';
import {
  DERIVATION_MANAGEMENT_SCOPE,
  hasScope
} from '../../../derivation/Derivation';
import { HttpHandlerRequest } from '../models/HttpHandler';
import { RequestValidator, RequestValidatorInput, RequestValidatorOutput } from './RequestValidator';

/**
 * Validates management access tokens that are bound to a single derivation resource.
 */
export class DerivationManagementTokenValidator extends RequestValidator {
  public constructor(
    protected readonly keyGen: JwkGenerator,
    protected readonly baseUrl: string,
  ) {
    super();
  }

  public async handle({ request }: RequestValidatorInput): Promise<RequestValidatorOutput> {
    const token = this.extractBearerToken(request);
    const payload = await this.verifyToken(token);
    const resourceId = payload.derivation_resource_id;
    if (typeof resourceId !== 'string') {
      throw new ForbiddenHttpError('Management token is not bound to a derivation resource.');
    }
    if (!hasScope(typeof payload.scope === 'string' ? payload.scope : undefined, DERIVATION_MANAGEMENT_SCOPE)) {
      throw new ForbiddenHttpError('Management token does not have the derivation management scope.');
    }
    if (typeof request.parameters?.id === 'string' && request.parameters.id !== resourceId) {
      throw new ForbiddenHttpError('Management token is not valid for this derivation resource.');
    }

    return {
      owner: typeof payload.sub === 'string' ? payload.sub : `derivation-resource:${resourceId}`,
      resourceServer: typeof payload.client_id === 'string' ? payload.client_id : undefined,
      resourceId,
      allowCreate: true,
    };
  }

  protected extractBearerToken(request: HttpHandlerRequest): string {
    const { authorization } = request.headers;
    if (!authorization || !/^Bearer /ui.test(authorization)) {
      throw new UnauthorizedHttpError('No Bearer Authorization header specified.');
    }
    return authorization.replace(/^Bearer/ui, '').trimStart();
  }

  protected async verifyToken(token: string): Promise<JWTPayload> {
    const key = await this.keyGen.getPublicKey();
    const jwk = await importJWK(key, key.alg);
    const { payload } = await jwtVerify(token, jwk, {
      issuer: this.baseUrl,
      audience: this.baseUrl,
    });
    return payload;
  }
}
