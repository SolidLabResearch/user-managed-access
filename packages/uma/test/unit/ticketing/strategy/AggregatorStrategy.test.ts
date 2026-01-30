import { KeyValueStorage } from '@solid/community-server';
import { Mocked } from 'vitest';
import { ACCESS } from '../../../../src/credentials/Claims';
import { ClaimSet } from '../../../../src/credentials/ClaimSet';
import { RequiredClaim } from '../../../../src/errors/NeedInfoError';
import { AggregatorStrategy } from '../../../../src/ticketing/strategy/AggregatorStrategy';
import { TicketingStrategy } from '../../../../src/ticketing/strategy/TicketingStrategy';
import { Ticket } from '../../../../src/ticketing/Ticket';
import { UMA_SCOPES } from '../../../../src/ucp/util/Vocabularies';
import { decodeAggregateId, encodeAggregateId } from '../../../../src/util/AggregatorUtil';
import { RegistrationStore } from '../../../../src/util/RegistrationStore';
import { Failure, Result, Success } from '../../../../src/util/Result';
import { Permission } from '../../../../src/views/Permission';

describe('AggregatorStrategy', (): void => {
  let encodedIds: string[];
  let derivedIds: string[];
  let permissions: Permission[];
  let ticket: Ticket;
  let claims: ClaimSet;
  let source: Mocked<TicketingStrategy>;
  let registrationStore: Mocked<RegistrationStore>;
  let derivationStore: Mocked<KeyValueStorage<string, string>>;
  let strategy: AggregatorStrategy;

  beforeEach(async(): Promise<void> => {
    encodedIds = [ await encodeAggregateId('decoded'), await encodeAggregateId('not-decoded') ];
    derivedIds = [ await encodeAggregateId('d1'), await encodeAggregateId('d2'), await encodeAggregateId('d3') ];
    ticket = {
      permissions: [
        { resource_id: 'id', resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
        { resource_id: encodedIds[0], resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ]},
        { resource_id: encodedIds[1], resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
        { resource_id: derivedIds[0], resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ]},
        { resource_id: derivedIds[1], resource_scopes: [ 'urn:knows:uma:scopes:derivation-read', 'http://www.w3.org/ns/odrl/2/read' ]},
        { resource_id: derivedIds[2], resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ]},
      ],
      provided: {},
      derivedIds: derivedIds,
    };

    claims = {
      [ACCESS]: [
        { resource_id: derivedIds[0], resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ] },
        { resource_id: derivedIds[1], resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ] },
        { resource_id: derivedIds[2], resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ] }
      ],
    }

    permissions = [
      { resource_id: 'id', resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
    ];

    source = {
      initializeTicket: vi.fn(async (permissions: Permission[]): Promise<Ticket> => ({ permissions, provided: {} })),
      validateClaims: vi.fn(async (ticket: Ticket) => ticket),
      resolveTicket: vi.fn().mockResolvedValue(Success([])),
    } satisfies Partial<TicketingStrategy> as any;

    registrationStore = {
      get: vi.fn().mockResolvedValue({
        owner: 'owner',
        description: {
          resource_scopes: [ 'derive' ],
          derived_from: [
            { derivation_resource_id: 'd1', issuer: 'issuer' },
            { derivation_resource_id: 'd2', issuer: 'issuer' }
          ],
        },
      }),
    } satisfies Partial<RegistrationStore> as any;

    derivationStore = {
      get: vi.fn().mockResolvedValue('issuer'),
    } satisfies Partial<KeyValueStorage<string, string>> as any;

    strategy = new AggregatorStrategy(source, registrationStore, derivationStore);
  });

  describe('initializeTicket', (): void => {
    it('adds derived_from sources to the required permissions.', async(): Promise<void> => {
      await expect(strategy.initializeTicket(permissions)).resolves.toEqual({
        permissions: [
          { resource_id: 'id', resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
          { resource_id: 'd1', resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ]},
          { resource_id: 'd2', resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ]},
        ],
        derivedIds: [ 'd1', 'd2' ],
        provided: {},
      });
    });

    it('returns the source result if there are no derived resources.', async(): Promise<void> => {
      registrationStore.get.mockResolvedValueOnce({
        owner: 'owner',
        description: {
          resource_scopes: [ 'read' ],
        },
      });
      await expect(strategy.initializeTicket(permissions)).resolves.toEqual({
        permissions,
        provided: {},
        derivedIds: [],
      });
    });

    it('errors if there are derived identifiers combined with non-read permissions.', async(): Promise<void> => {
      permissions[0].resource_scopes = [ 'other' ];
      await expect(strategy.initializeTicket(permissions)).rejects.toThrow(
        'Derived resources are only supported with http://www.w3.org/ns/odrl/2/read permissions, received other');
    });
  });

  describe('validateClaims', (): void => {
    it('handles derivation-read permissions and decodes IDs for the source.', async(): Promise<void> => {
      await expect(strategy.validateClaims(ticket, claims)).resolves.toEqual({
        derivedIds: [ derivedIds[0], derivedIds[1], derivedIds[2] ],
        permissions: [
          { resource_id: 'id', resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
          { resource_id: encodedIds[0], resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ]},
          { resource_id: encodedIds[1], resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
          { resource_id: derivedIds[1], resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
          { resource_id: derivedIds[2], resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ]},
        ],
        provided: {},
      });

      expect(source.validateClaims).toHaveBeenCalledExactlyOnceWith(
        {
          derivedIds: [ derivedIds[0], derivedIds[1], derivedIds[2] ],
          permissions: [
            { resource_id: 'id', resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
            // Only this one will be decoded as it is not derived but has a derivation-read scope
            { resource_id: 'decoded', resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ]},
            { resource_id: encodedIds[1], resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
            { resource_id: derivedIds[1], resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
            { resource_id: derivedIds[2], resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ]},
          ],
          provided: {},
        },
        claims);
    });
  });

  describe('resolveTicket', (): void => {
    it('returns success if all permissions were handled.', async(): Promise<void> => {
      ticket.permissions = [
        { resource_id: 'id', resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
        { resource_id: encodedIds[0], resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ]},
        { resource_id: encodedIds[1], resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
      ];
      source.resolveTicket.mockResolvedValueOnce(Success([
        { resource_id: 'id', resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
        { resource_id: 'decoded', resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ]},
        { resource_id: encodedIds[1], resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
      ]));
      await expect(strategy.resolveTicket(ticket)).resolves.toEqual(Success([
        { resource_id: 'id', resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
        // Results are encoded again to not leak internal identifiers
        { resource_id: encodedIds[0], resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ]},
        { resource_id: encodedIds[1], resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
      ]));
      expect(source.resolveTicket).toHaveBeenCalledExactlyOnceWith({
        ...ticket,
        permissions: [
          { resource_id: 'id', resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
          { resource_id: 'decoded', resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ]},
          { resource_id: encodedIds[1], resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
        ]
      });
    });

    it('returns the required claims if derivation-read access is missing.', async(): Promise<void> => {
      ticket.permissions = [
        { resource_id: 'id', resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
        { resource_id: encodedIds[0], resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ]},
        { resource_id: encodedIds[1], resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
        { resource_id: derivedIds[1], resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]},
        { resource_id: derivedIds[2], resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ]},
      ]
      await expect(strategy.resolveTicket(ticket)).resolves.toEqual(Failure([{
        claim_token_format: 'urn:ietf:params:oauth:token-type:access_token',
        issuer: 'issuer',
        derivation_resource_id: derivedIds[2],
        resource_scopes: [UMA_SCOPES['derivation-read']],
      }]));
    });
  });
});
