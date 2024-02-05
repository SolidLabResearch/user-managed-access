import { getLoggerFor } from '../../util/logging/LoggerUtils';
import { Authorizer } from './Authorizer';
import { Permission } from '../../views/Permission';
import { Requirements } from '../../credentials/Requirements';
import { ClaimSet } from '../../credentials/ClaimSet';

const NO_RESOURCE = Symbol();
const namespace = (resource: string) => new URL(resource).pathname.split('/')?.[2] ?? '';

/**
 * An authorizer delegating to different authorizers based on the namespaces in the request.
 */
export class NamespacedAuthorizer implements Authorizer {
  protected readonly logger = getLoggerFor(this);

  /**
   * Creates a NamespacedAuthorizer with the given namespaces.
   * 
   * @param config - A list of objects refering a list of namespaces to a specific Authorizer.
   */
  constructor(
    protected authorizers: Record<string, Authorizer>,
    protected fallback: Authorizer,
  ) {}

  /** @inheritdoc */
  public async permissions(claims: ClaimSet, query?: Partial<Permission>[]): Promise<Permission[]> {
    this.logger.info('Calculating permissions.', { claims, query });

    const permissions: Permission[] = [];
    for (const permission of query ?? []) {
      const resource = permission.resource_id;
      const ns = resource ? namespace(resource) : undefined;
      const authorizer = ns ? this.authorizers[ns] : undefined;

      permissions.push(... await (authorizer ?? this.fallback).permissions(claims, [ permission ]));
    }

    return permissions;
  }

  /** @inheritdoc */
  public async credentials(permissions: Permission[], query?: Requirements): Promise<Requirements> {
    this.logger.info('Calculating credentials.', { permissions, query });

    const credentials: Requirements = {};
    for (const permission of permissions) {
      const resource = permission.resource_id;
      const ns = resource ? namespace(resource) : undefined;
      const authorizer = ns ? this.authorizers[ns] : undefined;

      const result = await (authorizer ?? this.fallback).credentials([ permission ], query);
      // TODO: look into merging results with same key
      for (const key of Object.keys(result)) credentials[key] = result[key]; 
    }

    return credentials;
  }
}
