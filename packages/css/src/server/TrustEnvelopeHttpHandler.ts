import {
  asyncToArray,
  BasicRepresentation,
  guardedStreamFrom,
  INTERNAL_QUADS,
  OperationHttpHandler,
  OperationHttpHandlerInput,
  PREFERRED_PREFIX_TERM,
  RDF,
  RepresentationConverter,
  ResponseDescription,
  SOLID_META,
  XSD
} from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { DataFactory as DF, Literal, Quad } from 'n3';
import { UmaClaims, UmaClient } from '../uma/UmaClient';
import type { Fetcher } from '../util/fetch/Fetcher';
import { OwnerUtil } from '../util/OwnerUtil';
import { DCTERMS, DPV, ODRL, TE } from '../util/Vocabularies';

/**
 * A handler that wraps the outgoing data in a trust envelope,
 * based on the contents of the UMA access token.
 * As the trust envelope is combined with the data response,
 * this only works with RDF response data.
 * It is also assumed the identifier of the resource is the main subject for the RDF response.
 *
 * As this class needs to have access to both authorization data and response data,
 * it is situated before the RepresentationStore stack.
 * This complicates the situation a bit as this means data conversion
 * can no longer be handled by the RepresentationStore.
 * An alternative solution where this is not the case,
 * would require the authorization data to somehow get passed along to the RepresentationStore request.
 * For example, as ephemeral metadata.
 * The issue there is that it might create issues that this metadata is mixed with the data,
 * which could be an example for PATCH, for example.
 *
 * Many assumptions are still made in the code.
 */
export class TrustEnvelopeHttpHandler extends OperationHttpHandler {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    protected readonly converter: RepresentationConverter,
    protected readonly operationHandler: OperationHttpHandler,
    protected readonly umaClient: UmaClient,
    protected readonly ownerUtil: OwnerUtil,
    protected readonly fetcher: Fetcher,
  ) {
    super();
  }

  public async canHandle(operation: OperationHttpHandlerInput): Promise<void> {
    return this.operationHandler.canHandle(operation);
  }

  public async handle(input: OperationHttpHandlerInput): Promise<ResponseDescription> {
    if (input.operation.method !== 'GET') {
      return this.operationHandler.handle(input);
    }

    // TODO: simultaneous promises for speedup
    const response = await this.operationHandler.handle(input);

    const conversionArgs = {
      preferences: { type: {[INTERNAL_QUADS]: 1}},
      identifier: input.operation.target,
      representation: new BasicRepresentation(response.data!, response.metadata!),
    }
    try {
      await this.converter.canHandle(conversionArgs);
    } catch {
      return response;
    }

    let owners: string[];
    let verified: UmaClaims | undefined;
    try {
      owners = await this.ownerUtil.findOwners(input.operation.target);
      verified = await this.introspect(input, owners);
    } catch {
      return response;
    }

    if (!verified) {
      return response;
    }

    const envelopeQuads = this.generateEnvelopeData(verified, owners);

    const quadData = await this.converter.handle(conversionArgs);

    // TODO: inefficient stream merging
    const mergedData = [
      ...await asyncToArray(quadData.data),
      ...envelopeQuads,
    ];
    quadData.data = guardedStreamFrom(mergedData);

    quadData.metadata.addQuad(DCTERMS.terms.namespace, PREFERRED_PREFIX_TERM, 'dcterms', SOLID_META.terms.ResponseMetadata);
    quadData.metadata.addQuad(DPV.terms.namespace, PREFERRED_PREFIX_TERM, 'dpv', SOLID_META.terms.ResponseMetadata);
    quadData.metadata.addQuad('http://example.com/ns/', PREFERRED_PREFIX_TERM, 'ex', SOLID_META.terms.ResponseMetadata);
    quadData.metadata.addQuad(ODRL.terms.namespace, PREFERRED_PREFIX_TERM, 'odrl', SOLID_META.terms.ResponseMetadata);
    quadData.metadata.addQuad(TE.terms.namespace, PREFERRED_PREFIX_TERM, 'te', SOLID_META.terms.ResponseMetadata);

    const preferredType = input.operation.preferences.type ?? {[response.metadata!.contentType!]: 1};
    const originalType = await this.converter.handleSafe({
      preferences: { type: preferredType },
      identifier: input.operation.target,
      representation: quadData,
    });

    return {
      data: originalType.data,
      metadata: originalType.metadata,
      statusCode: response.statusCode,
    };
  }

  protected async introspect(input: OperationHttpHandlerInput, owners: string[]): Promise<UmaClaims | undefined> {
    const authorization = input.request.headers.authorization;
    if (!authorization || !authorization.match(/.+ .+/)) {
      return;
    }
    const token = authorization.split(' ')[1];
    console.log('TOKEN', token, owners);
    if (owners.length === 0) {
      return;
    }
    const issuer = await this.ownerUtil.findIssuer(owners[0]);
    if (!issuer) {
      return;
    }

    // TODO: the UMA client `verifyOpaqueToken` seems to combine two different conflicting ideas,
    //       so just performing introspection here
    const config = await this.umaClient.fetchUmaConfig(issuer);
    const res = await this.fetcher.fetch(config.introspection_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: `token_type_hint=access_token&token=${token}`,
    });

    if (res.status >= 400) {
      throw new Error(`Unable to introspect UMA RPT for Authorization Server '${config.issuer}'`);
    }

    return res.json() as Promise<UmaClaims>;
  }

  protected generateEnvelopeData(verified: UmaClaims, owners?: string[]): Quad[] {
    const envelope = DF.namedNode('http://example.com/ns/envelope');
    const dataProv = DF.namedNode('http://example.com/ns/dataProvenance');
    const policyProv = DF.namedNode('http://example.com/ns/policyProvenance');

    const signedEnvelope = DF.namedNode('http://example.com/ns/signedEnvelope');
    const signedDataProv = DF.namedNode('http://example.com/ns/signedDataProvenance');
    const signedPolicyProv = DF.namedNode('http://example.com/ns/signedPolicyProvenance');

    const quads: Quad[] = [];

    let date: Literal | undefined;
    if (verified.iat) {
      date = DF.literal(new Date(verified.iat).toISOString(), XSD.terms.dateTime);
    }

    quads.push(
      DF.quad(envelope, RDF.terms.type, TE.terms.TrustEnvelope),
      DF.quad(envelope, TE.terms.provenance, dataProv),
      DF.quad(envelope, TE.terms.provenance, policyProv),
      DF.quad(envelope, TE.terms.sign, signedEnvelope),
      DF.quad(dataProv, RDF.terms.type, TE.terms.DataProvenance),
      DF.quad(dataProv, TE.terms.sign, signedDataProv),
      DF.quad(policyProv, RDF.terms.type, TE.terms.PolicyProvenance),
      DF.quad(policyProv, TE.terms.sign, signedPolicyProv),
    );

    if (date) {
      quads.push(
        DF.quad(envelope, DCTERMS.terms.issued, date),
        DF.quad(dataProv, DCTERMS.terms.issued, date),
        DF.quad(policyProv, DCTERMS.terms.issued, date),
      );
    }
    if (verified.iss) {
      quads.push(DF.quad(dataProv, TE.terms.sender, DF.namedNode(verified.iss)))
    }
    for (const owner of owners ?? []) {
      quads.push(DF.quad(policyProv, TE.terms.rightsHolder, DF.namedNode(owner)));
    }
    for (const permission of verified.permissions ?? []) {
      // TODO: these need to linked together in a more correct way
      quads.push(
        // TODO: this is the UMA ID, need to convert to local ID
        DF.quad(envelope, DPV.terms.hasData, DF.namedNode(permission.resource_id)),
        DF.quad(dataProv, DPV.terms.hasDataSubject, DF.namedNode(permission.resource_id)),
      );
      for (const policy of permission.policies ?? []) {
        quads.push(
          DF.quad(envelope, ODRL.terms.hasPolicy, DF.namedNode(policy)),
        );
      }
    }

    if (verified.requestClaims) {
      const webId = verified.requestClaims['urn:solidlab:uma:claims:types:webid'];
      const purpose = verified.requestClaims['http://www.w3.org/ns/odrl/2/purpose'];
      if (typeof webId === 'string') {
        quads.push(DF.quad(policyProv, TE.terms.recipient, DF.namedNode(webId)));
      }
      if (typeof purpose === 'string') {
        // TODO: purpose not actually part of trust envelope, just dumping this in here for now
        quads.push(DF.quad(policyProv, DF.namedNode(TE.namespace + 'TODO-purpose'), DF.namedNode(purpose)));
      }
    }

    return quads;
  }
}
