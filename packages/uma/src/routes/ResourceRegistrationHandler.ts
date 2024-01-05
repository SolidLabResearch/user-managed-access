import {BadRequestHttpError} from '../http/errors/BadRequestHttpError';
import {HttpHandler} from '../http/models/HttpHandler';
import {HttpHandlerContext} from '../http/models/HttpHandlerContext';
import {HttpHandlerResponse} from '../http/models/HttpHandlerResponse';
import {UnauthorizedHttpError} from '../http/errors/UnauthorizedHttpError';
import {UnsupportedMediaTypeHttpError} from '../http/errors/UnsupportedMediaTypeHttpError';
import * as jose from 'jose';
import {Logger} from '../logging/Logger';
import {getLoggerFor} from '../logging/LoggerUtils';
import {KeyValueStore} from '../storage/models/KeyValueStore';
import {v4} from 'uuid';
import { HttpMethods } from '../http/models/HttpMethod';
import { MethodNotAllowedHttpError } from '../http/errors/MethodNotAllowedHttpError';
import { HttpHandlerRequest } from '../http/models/HttpHandlerRequest';
import { ResourceDescription } from '../models/ResourceDescription';
import { reType } from '../util/ReType.js';

type ErrorConstructor = { new(msg: string): Error };

/**
 * A ResourceRegistrationHandler is tasked with implementing
 * section 3.2 from the User-Managed Access (UMA) Federated Auth 2.0.
 *
 * It provides an endpoint to a Resource Server for registering its resources.
 */
export class ResourceRegistrationHandler implements HttpHandler {
  protected readonly logger: Logger = getLoggerFor(this);

  /**
   * @param {string} baseUrl - Base URL of the AS.
   * @param {RequestingPartyRegistration[]} resourceServers - Pod Servers to be registered with the UMA AS
   */
  constructor(
    private readonly baseUrl: string,
    private readonly resourceStore: KeyValueStore<string, ResourceDescription>,
    // private readonly resourceServers: RequestingPartyRegistration[],
  ) {}

  /**
  * Handle incoming requests for resource registration
  * @param {HttpHandlerContext} param0
  * @return {Observable<HttpHandlerResponse<PermissionRegistrationResponse>>}
  */
  handle({ request }: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    if (!request.headers.authorization) {
      throw new UnauthorizedHttpError('Missing authorization header in request.');
    }

    // TODO: validate PAT
    //await this.validateAuthorization(authorizationHeader);

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
