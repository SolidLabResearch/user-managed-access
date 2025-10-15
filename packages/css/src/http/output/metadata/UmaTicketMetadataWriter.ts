import { addHeader, HTTP, HttpResponse, MetadataWriter, RepresentationMetadata } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { WWW_AUTH } from '../../../authorization/UmaAuthorizer';

/**
 * Adds the `WWW-Authenticate` header with the injected value in case the response status code is 401.
 */
export class UmaTicketMetadataWriter extends MetadataWriter {
  protected readonly logger = getLoggerFor(this);

  /**
   * Add the WWW-Authenticate header to the response in case of a 401 error response
   * @param {AsWwwAuthHandlerArgs} input
   */
  public async handle(input: {
    response: HttpResponse;
    metadata: RepresentationMetadata;
  }): Promise<void> {
    const statusCode = input.metadata.get(HTTP.terms.statusCodeNumber)?.value;

    if (statusCode === '401' || statusCode === '403') {
      const authHeader = input.metadata.get(WWW_AUTH)?.value;
      if (authHeader) {
        this.logger.info(`Writing UMA auth header to response: ${authHeader}`);
        addHeader(input.response, 'WWW-Authenticate', authHeader);
      }
    }
  }
}
