import {BadRequestHttpError} from '../util/http/errors/BadRequestHttpError';
import {HttpHandlerContext} from '../util/http/models/HttpHandlerContext';
import {HttpHandler} from '../util/http/models/HttpHandler';
import {HttpHandlerResponse} from '../util/http/models/HttpHandlerResponse';
import {UnauthorizedHttpError} from '../util/http/errors/UnauthorizedHttpError';
import {UnsupportedMediaTypeHttpError} from '../util/http/errors/UnsupportedMediaTypeHttpError';
import {Logger} from '../util/logging/Logger';
import {getLoggerFor} from '../util/logging/LoggerUtils';
import {KeyValueStore} from '../util/storage/models/KeyValueStore';
import {AccessToken} from '../tokens/AccessToken';
import { JwtTokenFactory } from '../tokens/JwtTokenFactory';
import { SerializedToken } from '../tokens/TokenFactory';

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
  async handle({request}: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
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
      throw new UnauthorizedHttpError('Missing authorization header in request.');
    }

    if (request.headers['content-type'] !== 'application/x-www-form-urlencoded') {
      throw new UnsupportedMediaTypeHttpError(
          'Only Media Type "application/x-www-form-urlencoded" is supported for this route.');
    }

    if (request.headers['accept'] !== 'application/json') {
      throw new UnsupportedMediaTypeHttpError(
          'Only "application/json" can be served by this route.');
    }

    if (!request.body || !(request.body instanceof Object)) {
      throw new BadRequestHttpError('Missing request body.');
    }

    try {
      const opaqueToken = new URLSearchParams(request.body).get('token');
      if (!opaqueToken) throw new Error ();
      
      const jwt = this.opaqueToJwt(opaqueToken);
      return {
        headers: {'content-type': 'application/json'},
        status: 200,
        body: jwt,
      };
    } catch (e) {
      throw new BadRequestHttpError('Invalid request body.');
    }

  }

  private async opaqueToJwt(opaque: string): Promise<SerializedToken> {
    const token = await this.tokenStore.get(opaque);
    if (!token) throw new Error('Token not found.');

    return this.jwtTokenFactory.serialize(Object.assign(token, { active: true }));
  }

}