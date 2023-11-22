import {BadRequestHttpError} from '../http/errors/BadRequestHttpError';
import {HttpHandlerContext} from '../http/models/HttpHandlerContext';
import {HttpHandler} from '../http/models/HttpHandler';
import {HttpHandlerResponse} from '../http/models/HttpHandlerResponse';
import {UnauthorizedHttpError} from '../http/errors/UnauthorizedHttpError';
import {UnsupportedMediaTypeHttpError} from '../http/errors/UnsupportedMediaTypeHttpError';
import {from, map, Observable, of, throwError} from 'rxjs';
import {Logger} from '../logging/Logger';
import {getLoggerFor} from '../logging/LoggerUtils';
import {KeyValueStore} from '../storage/models/KeyValueStore';
import {AccessToken} from '../models/AccessToken';
import { JwtTokenFactory } from '../token/JwtTokenFactory';
import { SerializedToken } from '../token/TokenFactory';

/**
 * 
 */
export class IntrospectionHandler implements HttpHandler {
  protected readonly logger: Logger = getLoggerFor(this);

  /**
   * 
   */
  constructor(
    private readonly tokenStore: KeyValueStore<string, AccessToken>,
    private jwtTokenFactory: JwtTokenFactory,
  ) {}

  /**
  * Handle incoming requests for token introspection
  * @param {HttpHandlerContext} param0
  * @return {Observable<HttpHandlerResponse<any>>}
  */
  handle({request}: HttpHandlerContext): Observable<HttpHandlerResponse<any>> {
      // const request = {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${pat}`,
      //     'Content-Type': 'application/x-www-form-urlencoded',
      //     'Accept': 'application/json',
      //   },
      //   body: `token_type_hint=access_token&token=${token}`,
      // };

    // TODO: check PAT
    if (!request.headers.authorization) {
      return throwError(() => new UnauthorizedHttpError('Missing authorization header in request.'));
    }

    if (request.headers['content-type'] !== 'application/x-www-form-urlencoded') {
      return throwError(() => new UnsupportedMediaTypeHttpError(
          'Only Media Type "application/x-www-form-urlencoded" is supported for this route.'));
    }

    if (request.headers['accept'] !== 'application/json') {
      return throwError(() => new UnsupportedMediaTypeHttpError(
          'Only "application/json" can be served by this route.'));
    }

    if (!request.body || !(request.body instanceof Object)) {
      return throwError(() => new BadRequestHttpError('Missing request body.'));
    }

    try {
      const opaqueToken = new URLSearchParams(request.body).get('token');
      if (!opaqueToken) throw new Error ();
      
      return from(this.opaqueToJwt(opaqueToken)).pipe((jwt) => of({
        headers: {'content-type': 'application/json'},
        status: 200,
        body: jwt,
      }));
    } catch (e) {
      return throwError(() => new BadRequestHttpError('Invalid request body.'));
    }

  }

  private async opaqueToJwt(opaque: string): Promise<SerializedToken> {
    const token = await this.tokenStore.get(opaque);
    if (!token) throw new Error('Token not found.');

    return this.jwtTokenFactory.serialize(Object.assign(token, { active: true }));
  }

}
