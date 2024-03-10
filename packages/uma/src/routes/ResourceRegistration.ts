import {BadRequestHttpError} from '../util/http/errors/BadRequestHttpError';
import {HttpHandler} from '../util/http/models/HttpHandler';
import {HttpHandlerContext} from '../util/http/models/HttpHandlerContext';
import {HttpHandlerResponse} from '../util/http/models/HttpHandlerResponse';
import {UnauthorizedHttpError} from '../util/http/errors/UnauthorizedHttpError';
import {UnsupportedMediaTypeHttpError} from '../util/http/errors/UnsupportedMediaTypeHttpError';
import {Logger} from '../util/logging/Logger';
import {getLoggerFor} from '../util/logging/LoggerUtils';
import {KeyValueStore} from '../util/storage/models/KeyValueStore';
import {v4} from 'uuid';
import { HttpMethods } from '../util/http/models/HttpMethod';
import { MethodNotAllowedHttpError } from '../util/http/errors/MethodNotAllowedHttpError';
import { HttpHandlerRequest } from '../util/http/models/HttpHandlerRequest';
import { ResourceDescription } from '../views/ResourceDescription';
import { reType } from '../util/ReType';
import { extractRequestSigner, verifyRequest } from '../util/HttpMessageSignatures';

type ErrorConstructor = { new(msg: string): Error };

/**
 * A ResourceRegistrationRequestHandler is tasked with implementing
 * section 3.2 from the User-Managed Access (UMA) Federated Auth 2.0.
 *
 * It provides an endpoint to a Resource Server for registering its resources.
 */
export class ResourceRegistrationRequestHandler implements HttpHandler {
  protected readonly logger: Logger = getLoggerFor(this);

  /**
   * @param {RequestingPartyRegistration[]} resourceServers - Pod Servers to be registered with the UMA AS
   */
  constructor(
    private readonly resourceStore: KeyValueStore<string, ResourceDescription>,
  ) {}

  /**
  * Handle incoming requests for resource registration
  * @param {HttpHandlerContext} param0
  * @return {Observable<HttpHandlerResponse<PermissionRegistrationResponse>>}
  */
  async handle({ request }: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    const signer = await extractRequestSigner(request);

    // TODO: check if signer is actually the correct one

    if (!await verifyRequest(request, signer)) {
      throw new UnauthorizedHttpError(`Failed to verify signature of <${signer}>`);
    }

    switch (request.method) {
      case HttpMethods.POST: return this.handlePost(request);
      case HttpMethods.DELETE: return this.handleDelete(request);
      default: throw new MethodNotAllowedHttpError();
    }
  }

  private async handlePost(request: HttpHandlerRequest): Promise<HttpHandlerResponse<any>> {
    const { headers, body } = request;

    if (headers['content-type'] !== 'application/json') {
      throw new UnsupportedMediaTypeHttpError('Only Media Type "application/json" is supported for this route.');
    }

    try {
      reType(body, ResourceDescription);
    } catch (e) {
      this.logger.warn('Syntax error: ' + (e as Error).message, body);
      this.error(BadRequestHttpError, `Request has bad syntax${e instanceof Error ? ': ' + e.message : ''}`)
    }

    const resource = v4();
    this.resourceStore.set(resource, body);

    this.logger.info(`Registered resource ${resource}.`);

    return ({
      status: 201,
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        _id: resource,
        user_access_policy_uri: 'TODO: implement policy UI',
      }),
    })
  }

  private async handleDelete({ parameters }: HttpHandlerRequest): Promise<HttpHandlerResponse<any>> {
    if (typeof parameters?.id !== 'string') throw new Error('URI for DELETE operation should include an id.');

    if (!await this.resourceStore.has(parameters.id)) {
      throw new Error('Registration to be deleted does not exist (id unknown).');
    }

    this.logger.info(`Deleted resource ${parameters.id}.`);
    
    return ({
      status: 204,
      headers: {},
    });
  }

  /**
   * Logs and throws an error
   *
   * @param {ErrorConstructor} constructor - the error constructor
   * @param {string} message - the error message
   */
  private error(constructor: ErrorConstructor, message: string): never {
    this.logger.warn(message);
    throw new constructor(message);
  }
}
