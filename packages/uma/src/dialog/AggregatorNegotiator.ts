import { BadRequestHttpError, KeyValueStorage } from '@solid/community-server';
import { Ticket } from '../ticketing/Ticket';
import { UMA_SCOPES } from '../ucp/util/Vocabularies';
import { encodeAggregateId } from '../util/AggregatorUtil';
import { RegistrationStore } from '../util/RegistrationStore';
import { DialogInput } from './Input';
import { Negotiator } from './Negotiator';
import { DialogOutput } from './Output';

/**
 * Ensures the `derivation_resource_id` is present in Token responses when required for aggregators.
 */
export class AggregatorNegotiator implements Negotiator {
  public constructor(
    protected readonly negotiator: Negotiator,
    protected readonly ticketStore: KeyValueStorage<string, Ticket>,
    protected readonly registrationStore: RegistrationStore,
  ) {}

  public async negotiate(input: DialogInput): Promise<DialogOutput> {
    const scopes = input.scope?.split(' ') ?? [];
    // This class is only relevant for derivation-creation requests
    if (!scopes.includes(UMA_SCOPES['derivation-creation'])) {
      return this.negotiator.negotiate(input);
    }

    return this.negotiateDerivationCreation(input);
  }

  protected async negotiateDerivationCreation(input: DialogInput): Promise<DialogOutput> {
    // This needs to happen first as the source negotiator might already delete the stored ticket
    const ticket = await this.getTicket(input);
    if (ticket.permissions.length !== 1) {
      throw new BadRequestHttpError('Aggregate token requests require exactly 1 target resource identifier');
    }
    const resourceId = ticket.permissions[0].resource_id;

    // Add the new derivation-creation scope to the token
    ticket.permissions[0].resource_scopes.push(UMA_SCOPES['derivation-creation']);
    await this.ticketStore.set(input.ticket!, ticket);

    const result = await this.negotiator.negotiate(input);
    const derivationId = await encodeAggregateId(resourceId);
    return {
      ...result,
      derivation_resource_id: derivationId,
    }
  }

  protected async getTicket(input: DialogInput): Promise<Ticket> {
    if (input.ticket) {
      const ticket = await this.ticketStore.get(input.ticket);
      if (!ticket) {
        throw new BadRequestHttpError('Unknown ticket ID');
      }
      return ticket;
    } else {
      throw new BadRequestHttpError('Aggregators are only supported when using tickets.');
    }
  }
}
