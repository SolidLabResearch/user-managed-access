import { IdentifierMap, MultiPermissionMap, PermissionReader, PermissionReaderInput } from '@solid/community-server';
import { PermissionMap } from '@solidlab/policy-engine';
import { getLoggerFor } from 'global-logger-factory';
import { VocabularyValue } from 'rdf-vocabulary';
import { toCssMode } from '../uma/ScopeUtil';
import { UmaClaims } from '../uma/UmaClient';
import { MODES } from '../util/Vocabularies';

/**
 * PermissionReader using input from UMA Token to authorize the request.
 */
export class UmaPermissionReader extends PermissionReader {
  protected readonly logger = getLoggerFor(this);

  /**
     * Converts ticket to PermissionMap
     * @param {PermissionReaderInput} input
     * @return {Promise<PermissionMap>}
     */
  public async handle(input: PermissionReaderInput): Promise<MultiPermissionMap> {
    const now = Date.now() / 1000;
    const result = new IdentifierMap<PermissionMap>();
    if (!input.credentials.uma || !(input.credentials.uma as { rpt: UmaClaims }).rpt) {
      return result;
    }
    const { rpt } = input.credentials['uma'] as { rpt: UmaClaims };
    const { permissions, iat: t_iat, exp: t_exp, nbf: t_nbf } = rpt;

    this.logger.info(`Reading UMA permissions at ${now}`);

    try {
      if (t_iat && t_iat >= now) throw new Error(`Token seems to be issued in the future at ${t_iat}.`);
      if (t_exp && t_exp <= now) throw new Error(`Token is expired since ${t_exp}.`);
      if (t_nbf && t_nbf > now) throw new Error(`Token is not valid before ${t_nbf}.`);
    } catch (error) {
      this.logger.warn(`Invalid UMA token: ${error instanceof Error ? error.message : ''}`);
      return result;
    }

    for (const { resource_id, resource_scopes, iat: p_iat, exp: p_exp, nbf: p_nbf } of permissions ?? []) {
      const permissionSet = Object.fromEntries(resource_scopes.map(scope => {
        if (!scope.startsWith(MODES.namespace)) {
          this.logger.error(`Received unknown scope ${scope}`);
          return [];
        }

        try {
          if (p_iat && p_iat >= now) throw new Error(`UMA permission seems to be issued in the future at ${p_iat}.`);
          if (p_exp && p_exp <= now) throw new Error(`UMA permission is expired since ${p_exp}.`);
          if (p_nbf && p_nbf > now) throw new Error(`UMA permission is not valid before ${p_nbf}.`);
        } catch (error) {
          this.logger.warn(`Invalid UMA permission: ${error instanceof Error ? error.message : ''}`);

          return [toCssMode(scope as VocabularyValue<typeof MODES>), false];
        }
        return [toCssMode(scope as VocabularyValue<typeof MODES>), true];
      }));

      result.set({ path: resource_id }, permissionSet);
    }
    return result;
  }

}
