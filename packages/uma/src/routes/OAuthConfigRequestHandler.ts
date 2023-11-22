import {HttpHandler} from '../http/models/HttpHandler';
import {HttpHandlerContext} from '../http/models/HttpHandlerContext';
import {HttpHandlerResponse} from '../http/models/HttpHandlerResponse';
import {Observable, of} from 'rxjs';
import {Logger} from '../logging/Logger';
import {getLoggerFor} from '../logging/LoggerUtils';

export enum ResponseType {
    // eslint-disable-next-line no-unused-vars
    Token = 'token',
    // eslint-disable-next-line no-unused-vars
    Code = 'code',
    // eslint-disable-next-line no-unused-vars
    IDToken = 'id_token'
  }

export type OAuthConfiguration = {
    issuer: string,
    jwks_uri?: string,
    token_endpoint?: string,
    grant_types_supported?: string[],
    dpop_signing_alg_values_supported?: string[],
    response_types_supported?: ResponseType[]
    scopes_supported?: string[]
}

/**
 * An HttpHandler used for returning the configuration
 * of the UMA Authorization Service.
 */
export abstract class OAuthConfigRequestHandler<T extends OAuthConfiguration = OAuthConfiguration> extends HttpHandler {
  protected readonly logger: Logger = getLoggerFor(this);
  /**
     * Returns OAuth Configuration for the AS
     * @return {T} - AS Configuration
     */
  abstract getConfig(): T;

  /**
     * Returns the endpoint's UMA configuration
     *
     * @param {HttpHandlerContext} context - an irrelevant incoming context
     * @return {Observable<HttpHandlerResponse>} - the mock response
     */
  handle(context: HttpHandlerContext): Observable<HttpHandlerResponse> {
    this.logger.info(`Received discovery request at '${context.request.url}'`);
    const response: HttpHandlerResponse = {
      body: JSON.stringify(this.getConfig()),
      headers: {'content-type': 'application/json'},
      status: 200,
    };

    return of(response);
  }
}

