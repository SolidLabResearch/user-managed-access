import {ASYMMETRIC_CRYPTOGRAPHIC_ALGORITHM}
  from '@solid/access-token-verifier/dist/constant/ASYMMETRIC_CRYPTOGRAPHIC_ALGORITHM';
import {OAuthConfigRequestHandler, OAuthConfiguration, ResponseType} from '../routes/OAuthConfigRequestHandler';
import {Memoize} from 'typescript-memoize';


export type UmaConfiguration = OAuthConfiguration & {
  uma_profiles_supported: string[],
  resource_registration_endpoint: string,
  permission_endpoint: string,
  introspection_endpoint: string
};

/**
 * An HttpHandler used for returning the configuration
 * of the UMA Authorization Service.
 */
export class UmaConfigRequestHandler extends OAuthConfigRequestHandler<UmaConfiguration> {
  /**
    * An HttpHandler used for returning the configuration
    * of the UMA Authorization Service.
     * @param {string} baseUrl - Base URL of the AS
     */
  constructor(protected readonly baseUrl: string) {
    super();
  }
  /**
   * Returns UMA Configuration for the AS
   * @return {UmaConfiguration} - AS Configuration
   */
  @Memoize()
  public getConfig(): UmaConfiguration {
    return {
      jwks_uri: `${this.baseUrl}/keys`,
      token_endpoint: `${this.baseUrl}/token`,
      grant_types_supported: ['urn:ietf:params:oauth:grant-type:uma-ticket'],
      issuer: `${this.baseUrl}`,
      permission_endpoint: `${this.baseUrl}/register`,
      introspection_endpoint: `${this.baseUrl}/introspect`,
      resource_registration_endpoint: `${this.baseUrl}/resources`,
      uma_profiles_supported: ['http://openid.net/specs/openid-connect-core-1_0.html#IDToken'],
      dpop_signing_alg_values_supported: [...ASYMMETRIC_CRYPTOGRAPHIC_ALGORITHM],
      response_types_supported: [ResponseType.Token],
    };
  }
}
