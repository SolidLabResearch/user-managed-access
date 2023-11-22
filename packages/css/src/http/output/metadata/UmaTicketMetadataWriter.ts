import { MetadataWriter, getLoggerFor, HttpResponse,
  RepresentationMetadata, HTTP, addHeader, SOLID_META, AccessMap, IdentifierSetMultiMap, AccessMode } from '@solid/community-server';
import { UmaClient } from '../../../uma/UmaClient';
import { OwnerUtil } from '../../../util/OwnerUtil';
import { DataFactory } from 'n3';

const { blankNode } = DataFactory;

/**
 * Adds the `WWW-Authenticate` header with the injected value in case the response status code is 401.
 */
export class UmaTicketMetadataWriter extends MetadataWriter {
  protected readonly logger = getLoggerFor(this);

  /**
   * Adds the `WWW-Authenticate` header with the injected value in case the response status code is 401.
   * 
   * @param podStore 
   * @param authStrategy 
   * @param storageStrategy 
   */
  public constructor(
    protected ownerUtil: OwnerUtil, 
    protected umaClient: UmaClient
  ) {
    super();
  }

  /**
   * Add the WWW-Authenticate header to the response in case of a 401 error response
   * @param {AsWwwAuthHandlerArgs} input
   */
  public async handle(input: {
    response: HttpResponse;
    metadata: RepresentationMetadata;
  }): Promise<void> {
    if (input.metadata.get(HTTP.terms.statusCodeNumber)?.value !== '401') return;

    const requestedModes = this.readAccessMap(input.metadata);
    if (requestedModes.size === 0) return;   

    const owner = await this.ownerUtil.findCommonOwner(requestedModes.keys());
    const issuer = await this.ownerUtil.findIssuer(owner);

    if (!issuer) throw new Error(`No UMA authorization server found for ${owner}.`);

    try {
      const ticket = await this.umaClient.fetchTicket(requestedModes, owner, issuer);
      addHeader(input.response, 'WWW-Authenticate', `UMA realm="solid", as_uri="${issuer}", ticket="${ticket}"`);
    } catch (e) {
      this.logger.error(`Error while adding UMA header: ${(e as Error).message}`);
    }
  }

  private readAccessMap(metadata: RepresentationMetadata): AccessMap {
    const requestedModes: AccessMap = new IdentifierSetMultiMap();

    for (const bnode of metadata.getAll(SOLID_META.terms.requestedAccess).map(term => term.value)) {
      const [ target ] = metadata.quads(blankNode(bnode), SOLID_META.terms.accessTarget).map(quad => quad.object.value);
      const modes = metadata.quads(blankNode(bnode), SOLID_META.terms.accessMode).map(quad => <AccessMode>quad.object.value);
      
      requestedModes.add({ path: target }, new Set(modes));
    }

    return requestedModes;
  }

}
