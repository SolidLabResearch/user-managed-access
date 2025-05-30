import { ASYMMETRIC_CRYPTOGRAPHIC_ALGORITHM }
  from '@solid/access-token-verifier/dist/constant/ASYMMETRIC_CRYPTOGRAPHIC_ALGORITHM';
import { getLoggerFor } from '@solid/community-server';
import { HttpHandler, HttpHandlerContext, HttpHandlerResponse } from '../util/http/models/HttpHandler';

// eslint-disable no-unused-vars
export enum ResponseType {
  Token = 'token',
  Code = 'code',
  IDToken = 'id_token'
}
// eslint-enable

export type OAuthConfiguration = {
  issuer: string,
  jwks_uri?: string,
  token_endpoint?: string,
  grant_types_supported?: string[],
  dpop_signing_alg_values_supported?: string[],
  response_types_supported?: ResponseType[]
  scopes_supported?: string[]
}

export type UmaConfiguration = OAuthConfiguration & {
  uma_profiles_supported: string[],
  resource_registration_endpoint: string,
  permission_endpoint: string,
  introspection_endpoint: string
}

/**
 * An HttpHandler used for returning the configuration
 * of the UMA Authorization Service.
 */
export class ConfigRequestHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  /**
  * An HttpHandler used for returning the configuration
  * of the UMA Authorization Service.
    * @param {string} baseUrl - Base URL of the AS
    */
  constructor(protected readonly baseUrl: string) {
    super();
  }

  public async handle(context: HttpHandlerContext): Promise<HttpHandlerResponse> {
    this.logger.info(`Received discovery request at '${context.request.url}'`);

    return {
      body: this.getConfig(),
      status: 200,
    };
  }

  /**
   * Returns UMA Configuration for the AS
   * @return {UmaConfiguration} - AS Configuration
   */
  public getConfig(): UmaConfiguration {
    return {
      jwks_uri: `${this.baseUrl}/keys`,
      token_endpoint: `${this.baseUrl}/token`,
      grant_types_supported: ['urn:ietf:params:oauth:grant-type:uma-ticket'],
      issuer: `${this.baseUrl}`,
      permission_endpoint: `${this.baseUrl}/ticket`,
      introspection_endpoint: `${this.baseUrl}/introspect`,
      resource_registration_endpoint: `${this.baseUrl}/resources`,
      uma_profiles_supported: ['http://openid.net/specs/openid-connect-core-1_0.html#IDToken'],
      dpop_signing_alg_values_supported: [...ASYMMETRIC_CRYPTOGRAPHIC_ALGORITHM],
      response_types_supported: [ResponseType.Token],
    };
  }
}
