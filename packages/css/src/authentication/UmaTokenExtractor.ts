import { CredentialsExtractor, getLoggerFor, HttpRequest,
  NotImplementedHttpError, BadRequestHttpError, Credentials, TargetExtractor } from '@solid/community-server';
import { UmaClaims, UmaClient } from '../uma/UmaClient';
import { OwnerUtil } from '../util/OwnerUtil';
import { decodeJwt } from 'jose';

export type UmaCredentials = Credentials & { uma: { rpt: UmaClaims } };

/**
 * Credentials extractor which interprets the contents of the Bearer authorization token as a UMA Access Token.
 */
export class UmaTokenExtractor extends CredentialsExtractor {
  protected readonly logger = getLoggerFor(this);

  /**
   * Credentials extractor which interprets the contents of the Bearer authorization token as a UMA Access Token.
   * @param {UMATokenExtractorArgs} args - properties
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
      this.logger.info('No Bearer Authorization header specified.');
      throw new NotImplementedHttpError('No Bearer Authorization header specified.');
    }
  }

  /**
   * ...
   */
  public async handle(request: HttpRequest): Promise<UmaCredentials> {
    this.logger.info('Extracting token from ' + request.headers.authorization);
    const token = request.headers.authorization?.replace(/^Bearer/, '')?.trimStart();
    if (!token) throw new BadRequestHttpError('Found empty Bearer token.');
    this.logger.info('HEEEEEEEEERE');
    this.logger.info(JSON.stringify(decodeJwt(token)));
    try {
      const target = await this.targetExtractor.handle({ request });
      this.logger.info('TARGET: ' + target.path);
      const owners = await this.ownerUtil.findOwners(target);
      this.logger.info('OWNERS: ' + owners.join(', '));
      const issuers = await Promise.all(owners.map(o => this.ownerUtil.findIssuer(o)))
      this.logger.info('ISSUERS: ' + issuers.join(', '));
      const validIssuers = issuers.filter((i): i is string => i !== undefined);
    
      if (this.introspect) {
        this.logger.info('performing token introspection.');
        const results = await Promise.allSettled(owners.map(owner => this.tryIntrospection(token, owner)));
        const succeeded = results.filter((r): r is PromiseFulfilledResult<UmaClaims>  => r.status === 'fulfilled');
        if (succeeded.length === 0) throw new Error ();
        return { uma: { rpt: succeeded[0].value }};
      } else {
        this.logger.info('Verifying JWT.');
        const rpt = await this.client.verifyJwtToken(token, validIssuers ?? []);
        this.logger.info(JSON.stringify(rpt));
        return { uma: { rpt } };
      }
    } catch (error: unknown) {
      const msg = `Error verifying WebID via Bearer access token: ${(error as Error).message}`;
      this.logger.warn(msg);
      throw new BadRequestHttpError(msg, {cause: error});
    }
  }

  private async tryIntrospection(token: string, owner: string): Promise<UmaClaims> {
    const issuer = await this.ownerUtil.findIssuer(owner);
    if (!issuer) return Promise.reject();
    return this.client.verifyOpaqueToken(token, issuer, owner)
  }

}
