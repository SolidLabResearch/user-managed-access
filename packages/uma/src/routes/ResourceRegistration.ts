import {
  BadRequestHttpError,
  createErrorMessage,
  getLoggerFor,
  KeyValueStorage,
  MethodNotAllowedHttpError, NotFoundHttpError,
  UnauthorizedHttpError
} from '@solid/community-server';
import { randomUUID } from 'node:crypto';
import {
  HttpHandler,
  HttpHandlerContext,
  HttpHandlerRequest,
  HttpHandlerResponse
} from '../util/http/models/HttpHandler';
import { extractRequestSigner, verifyRequest } from '../util/HttpMessageSignatures';
import { reType } from '../util/ReType';
import { ResourceDescription } from '../views/ResourceDescription';

/**
 * A ResourceRegistrationRequestHandler is tasked with implementing
 * section 3.2 from the User-Managed Access (UMA) Federated Auth 2.0.
 *
 * It provides an endpoint to a Resource Server for registering its resources.
 */
export class ResourceRegistrationRequestHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  constructor(
    private readonly resourceStore: KeyValueStorage<string, ResourceDescription>,
  ) {
    super();
  }

  async handle({ request }: HttpHandlerContext): Promise<HttpHandlerResponse<any>> {
    const signer = await extractRequestSigner(request);

    // TODO: check if signer is actually the correct one

    if (!await verifyRequest(request, signer)) {
      throw new UnauthorizedHttpError(`Failed to verify signature of <${signer}>`);
    }

    switch (request.method) {
      case 'POST': return this.handlePost(request);
      case 'DELETE': return this.handleDelete(request);
      default: throw new MethodNotAllowedHttpError();
    }
  }

  private async handlePost(request: HttpHandlerRequest): Promise<HttpHandlerResponse<any>> {
    const { body } = request;

    try {
      reType(body, ResourceDescription);
    } catch (e) {
      this.logger.warn(`Syntax error: ${createErrorMessage(e)}, ${body}`);
      throw new BadRequestHttpError(`Request has bad syntax: ${createErrorMessage(e)}`);
    }

    const resource = randomUUID();
    await this.resourceStore.set(resource, body);

    this.logger.info(`Registered resource ${resource}.`);

    return ({
      status: 201,
      body: {
        _id: resource,
        user_access_policy_uri: 'TODO: implement policy UI',
      },
    })
  }

  private async handleDelete({ parameters }: HttpHandlerRequest): Promise<HttpHandlerResponse<any>> {
    if (typeof parameters?.id !== 'string') throw new Error('URI for DELETE operation should include an id.');

    if (!await this.resourceStore.delete(parameters.id)) {
      throw new NotFoundHttpError('Registration to be deleted does not exist (id unknown).');
    }

    this.logger.info(`Deleted resource ${parameters.id}.`);

    return { status: 204 };
  }
}
