import {
  CredentialsExtractor, getLoggerFor, HttpRequest,
  NotImplementedHttpError, BadRequestHttpError, Credentials, TargetExtractor, createErrorMessage
} from '@solid/community-server';
import { UmaClaims, UmaClient } from '../uma/UmaClient';
import { OwnerUtil } from '../util/OwnerUtil';

export type UmaCredentials = Credentials & { uma: { rpt: UmaClaims } };

/**
 * Credentials extractor which interprets the contents of the Bearer authorization token as a UMA Access Token.
 */
export class UmaTokenExtractor extends CredentialsExtractor {
  protected readonly logger = getLoggerFor(this);

  /**
   * Credentials extractor which interprets the contents of the Bearer authorization token as a UMA Access Token.
   * @param client - {@link UmaClient} to verify tokens.
   * @param targetExtractor - {@link TargetExtractor} to extract identifier from request.
   * @param ownerUtil - {@link OwnerUtil} to find owners and issuers.
   * @param introspect - If introspection should be used on incoming tokens.
   */
  public constructor(
    private client: UmaClient,
    private targetExtractor: TargetExtractor,
    private ownerUtil: OwnerUtil,
    private introspect: boolean = false,
  ) { super(); }

  /**
   * Tests if extractor can handle the request.
   * @param {HttpRequest} param0
   */
  public async canHandle({ headers }: HttpRequest): Promise<void> {
    const {authorization} = headers;
    if (!authorization || !/^Bearer /ui.test(authorization)) {
      this.logger.debug('No Bearer Authorization header specified.');
      throw new NotImplementedHttpError('No Bearer Authorization header specified.');
    }
  }

  public async handle(request: HttpRequest): Promise<UmaCredentials> {
    this.logger.info('Extracting token from ' + request.headers.authorization);

    const token = request.headers.authorization?.replace(/^Bearer/, '')?.trimStart();
    if (!token) throw new BadRequestHttpError('Found empty Bearer token.');

    try {
      const target = await this.targetExtractor.handleSafe({ request });
      const owners = await this.ownerUtil.findOwners(target);
      const issuers = await Promise.all(owners.map(o => this.ownerUtil.findIssuer(o)))
      const validIssuers = issuers.filter((i): i is string => i !== undefined);

      if (this.introspect) {
        this.logger.debug('Performing token introspection.');
        const results = await Promise.allSettled(
          validIssuers.map(issuer => this.client.verifyOpaqueToken(token, issuer)));
        const succeeded = results.filter((r): r is PromiseFulfilledResult<UmaClaims>  => r.status === 'fulfilled');
        if (succeeded.length === 0)
          throw new BadRequestHttpError(`Introspection failed: ${
            results.map((r): string => createErrorMessage((r as PromiseRejectedResult).reason)).join(',')}`);
        return { uma: { rpt: succeeded[0].value }};
      } else {
        this.logger.debug('Verifying JWT.');
        const rpt = await this.client.verifyJwtToken(token, validIssuers ?? []);

        return { uma: { rpt } };
      }
    } catch (error: unknown) {
      const msg = `Error verifying WebID via Bearer access token: ${createErrorMessage(error)}`;
      this.logger.warn(msg);
      throw new BadRequestHttpError(msg, {cause: error});
    }
  }
}
