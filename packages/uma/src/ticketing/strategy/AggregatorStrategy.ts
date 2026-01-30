import { BadRequestHttpError, InternalServerError, KeyValueStorage } from '@solid/community-server';
import { getLoggerFor } from 'global-logger-factory';
import { ACCESS } from '../../credentials/Claims';
import { ClaimSet } from '../../credentials/ClaimSet';
import { RequiredClaim } from '../../errors/NeedInfoError';
import { ODRL, UMA_SCOPES } from '../../ucp/util/Vocabularies';
import { decodeAggregateId } from '../../util/AggregatorUtil';
import { RegistrationStore } from '../../util/RegistrationStore';
import { Failure, Result } from '../../util/Result';
import { Permission } from '../../views/Permission';
import { Ticket } from '../Ticket';
import { TicketingStrategy } from './TicketingStrategy';

/**
 * TicketingStrategy that handles urn:knows:uma:scopes:read requests.
 */
export class AggregatorStrategy implements TicketingStrategy {
  protected readonly logger = getLoggerFor(this);

  public constructor(
    protected readonly strategy: TicketingStrategy,
    protected readonly registrationStore: RegistrationStore,
    protected readonly derivationStore: KeyValueStorage<string, string>,
  ) {}

  public async initializeTicket(permissions: Permission[]): Promise<Ticket> {
    const additionalPermissions: Permission[] = [];
    const derivedIds: string[] = [];
    // When on aggregator AS side: add derivation-read permission requirements for all derived_from resources of target
    for (const { resource_id: id, resource_scopes: scopes } of permissions) {
      const registration = await this.registrationStore.get(id);
      const derivedFrom = registration?.description.derived_from ?? [];
      if (derivedFrom.length > 0) {
        if (scopes.length > 1 || scopes[0] !== ODRL.read) {
          throw new BadRequestHttpError(
            `Derived resources are only supported with http://www.w3.org/ns/odrl/2/read permissions, received ${scopes}`);
        }
      }
      for (const derived of derivedFrom) {
        derivedIds.push(derived.derivation_resource_id);
        additionalPermissions.push({
          resource_id: derived.derivation_resource_id,
          resource_scopes: [ UMA_SCOPES['derivation-read']]
        });
      }
    }

    const ticket = await this.strategy.initializeTicket([ ...permissions, ...additionalPermissions ]);
    if (additionalPermissions.length > 0) {
      this.logger.info(`Adding additional derivation permission requirements: ${
        JSON.stringify(additionalPermissions)}`);
    }

    return {
      ...ticket,
      derivedIds: [...derivedIds, ...ticket.derivedIds ?? []],
    }
  }

  public async validateClaims(ticket: Ticket, claims: ClaimSet): Promise<Ticket> {
    // These IDs will be present on aggregator AS side, if the correct access tokens were provided
    const derivedReadIds = new Set<string>();
    if (Array.isArray(claims[ACCESS])) {
      for (const { resource_id: id, resource_scopes: scopes } of claims[ACCESS]) {
        if (scopes.includes(UMA_SCOPES['derivation-read'])) {
          derivedReadIds.add(id);
        }
      }
    }

    // On aggregator AS: see if we got the correct access tokens for the derivation-read requests
    const updatedPermissions: Permission[] = [];
    for (const permission of ticket.permissions) {
      const { resource_id: id, resource_scopes: scopes } = permission;
      if (ticket.derivedIds?.includes(id) && derivedReadIds.has(id) && scopes.includes(UMA_SCOPES['derivation-read'])) {
        const remainingScopes = scopes.filter((scope) => scope !== UMA_SCOPES['derivation-read']);
        if (remainingScopes.length > 0) {
          updatedPermissions.push({ resource_id: id, resource_scopes: remainingScopes });
        }
      } else {
        // Non-derivation permissions
        updatedPermissions.push(permission);
      }
    }

    const { ticket: newTicket, decodedIds } = await this.decodeIds({ ...ticket, permissions: updatedPermissions });

    // Send ticket with updated identifiers to source strategy
    const sourceTicket = await this.strategy.validateClaims(newTicket, claims);

    return this.encodeIds(sourceTicket, decodedIds);
  }

  public async resolveTicket(ticket: Ticket): Promise<Result<Permission[], RequiredClaim[]>> {
    const requiredClaims: RequiredClaim[] = [];

    // If there are still derivation-read permissions left, and this is an aggregator AS, there were insufficient claims
    for (const permission of ticket.permissions) {
      const { resource_id: id, resource_scopes: scopes } = permission;
      if (ticket.derivedIds?.includes(id) && scopes.includes(UMA_SCOPES['derivation-read'])) {
        const issuer = await this.derivationStore.get(id);
        if (!issuer) {
          throw new InternalServerError(`Missing issuer for derivation identifier ${id}`);
        }
        requiredClaims.push({
          claim_token_format: 'urn:ietf:params:oauth:token-type:access_token',
          issuer,
          derivation_resource_id: id,
          resource_scopes: [UMA_SCOPES['derivation-read']],
        });
      }
    }

    const { ticket: decodedTicket, decodedIds } = await this.decodeIds(ticket);
    const result = await this.strategy.resolveTicket(decodedTicket);

    if (result.success) {
      if (requiredClaims.length > 0) {
        return Failure(requiredClaims);
      }
      // Encode success values again to not leak actual resource IDs
      return {
        success: true,
        value: result.value.map((perm) => {
          const encoded = decodedIds[perm.resource_id];
          if (encoded) {
            return { resource_id: encoded, resource_scopes: perm.resource_scopes }
          }
          return perm;
        })
      }
    }
    // TODO: Failure result could potentially contain decoded IDs somewhere, but since the format is not set there yet, this could be anywhere
    return Failure([...result.value, ...requiredClaims]);
  }

  protected async decodeIds(ticket: Ticket): Promise<{ ticket: Ticket, decodedIds: Record<string, string> }> {
    const decodedIds: Record<string, string> = {};
    const updatedPermissions: Permission[] = [];
    for (const permission of ticket.permissions) {
      const { resource_id: id, resource_scopes: scopes } = permission;

      // Ignore derived IDs as the client is not directly trying to access those
      if (!ticket.derivedIds?.includes(id) && scopes.includes(UMA_SCOPES['derivation-read'])) {
        // On source AS: client is requesting the access token to get derivation-read permission.
        // These need to be converted to the actual internal identifiers.
        try {
          const decodedId = await decodeAggregateId(id);
          decodedIds[decodedId] = id;
          updatedPermissions.push({ resource_id: decodedId, resource_scopes: scopes });
        } catch {
          // Handle non-encoded IDs
          updatedPermissions.push(permission);
        }
      } else {
        updatedPermissions.push(permission);
      }
    }
    return {
      ticket: { ...ticket, permissions: updatedPermissions, provided: ticket.provided },
      decodedIds,
    }
  }

  protected encodeIds(ticket: Ticket, decodedIds: Record<string, string>): Ticket {
    if (Object.keys(decodedIds).length === 0) {
      return ticket;
    }

    const encodedPermissions = ticket.permissions.map((perm): Permission => {
      return { resource_id: decodedIds[perm.resource_id] ?? perm.resource_id, resource_scopes: perm.resource_scopes };
    })
    return {
      ...ticket,
      permissions: encodedPermissions,
      provided: ticket.provided,
    }
  }
}
