import { ForbiddenHttpError, NotImplementedHttpError, UnauthorizedHttpError } from '@solid/community-server';
import { HttpHandlerRequest } from '../../util/http/models/HttpHandler';
import { Credential } from '../Credential';
import { CredentialParser } from '../CredentialParser';

/**
 * Interprets Bearer Authorization headers as OIDC tokens.
 */
export class MappedSchemeParser extends CredentialParser {
  public constructor(
    protected readonly schemeMap: Record<string, string>,
  ) {
    super();
  }

  public async canHandle(request: HttpHandlerRequest): Promise<void> {
    if (!request.headers.authorization) {
      throw new UnauthorizedHttpError('Missing Authorization header.');
    }
    const scheme = request.headers.authorization.split(' ', 1)[0];
    if (!this.schemeMap[scheme]) {
      throw new ForbiddenHttpError(`Unsupported Authorization scheme ${scheme}.`);
    }
  }

  public async handle(request: HttpHandlerRequest): Promise<Credential> {
    const scheme = request.headers.authorization.split(' ', 1)[0];
    const token = request.headers.authorization.slice(scheme.length + 1);
    return { token, format: this.schemeMap[scheme] };
  }
}
