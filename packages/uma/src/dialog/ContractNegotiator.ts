import { createErrorMessage, getLoggerFor, KeyValueStorage } from '@solid/community-server';
import { Requirements } from '../credentials/Requirements';
import { Verifier } from '../credentials/verify/Verifier';
import { ContractManager } from '../policies/contracts/ContractManager';
import { TicketingStrategy } from '../ticketing/strategy/TicketingStrategy';
import { Ticket } from '../ticketing/Ticket';
import { AccessToken } from '../tokens/AccessToken';
import { TokenFactory } from '../tokens/TokenFactory';
import { processRequestPermission, switchODRLandCSSPermission } from '../util/rdf/RequestProcessing';
import { Result, Success } from '../util/Result';
import { reType } from '../util/ReType';
import { convertStringOrJsonLdIdentifierToString, ODRLContract, StringOrJsonLdIdentifier } from '../views/Contract';
import { Permission } from '../views/Permission';
import { BaseNegotiator } from './BaseNegotiator';
import { DialogInput } from './Input';
import { DialogOutput } from './Output';

/**
 * A mocked Negotiator for demonstration purposes to display contract negotiation
 */
export class ContractNegotiator extends BaseNegotiator {
  protected readonly logger = getLoggerFor(this);

  protected readonly contractManager = new ContractManager();

  /**
   * Construct a new Negotiator
   * @param verifier - The Verifier used to verify Claims of incoming Credentials.
   * @param ticketStore - A KeyValueStore to track Tickets.
   * @param ticketingStrategy - The strategy describing the life cycle of a Ticket.
   * @param tokenFactory - A factory for minting Access Tokens.
   */
  public constructor(
    protected verifier: Verifier,
    protected ticketStore: KeyValueStorage<string, Ticket>,
    protected ticketingStrategy: TicketingStrategy,
    protected tokenFactory: TokenFactory,
  ) {
    super(verifier, ticketStore, ticketingStrategy, tokenFactory);
    this.logger.warn('The Contract Negotiator is for demonstration purposes only! DO NOT USE THIS IN PRODUCTION !!!');
  }

  /**
   * Performs UMA grant negotiation.
   */
  public async negotiate(input: DialogInput): Promise<DialogOutput> {
    reType(input, DialogInput);
    if (!input.permissions && input.permission?.length) {
      input = {
        ...input,
        permissions: input.permission.map(p => processRequestPermission(p)),
      };
    }
    this.logger.debug(`Input. ${JSON.stringify(input)}`);
    // Create or retrieve ticket
    const ticket = await this.getTicket(input);
    this.logger.debug(`Processing ticket. ${JSON.stringify(ticket)}`);

    // Process pushed credentials
    const { ticket: updatedTicket } = await this.processCredentials(input, ticket);
    this.logger.debug(`Processed credentials ${JSON.stringify(updatedTicket)}`);

    // TODO:
    const result = await this.toContract(updatedTicket);

    if (result.success) {
      // TODO:
      return this.toResponse(result.value);
    }

    // ... on failure, deny if no solvable requirements
    this.denyRequest(ticket);
  }

  /**
   * Generates a contract based on the given ticket,
   * or returns one previously made,
   * and returns it as Success.
   *
   * In case the ticket is not resolved,
   * the needed requirements will be returned as Failure.
   */
  protected async toContract(ticket: Ticket): Promise<Result<ODRLContract, Requirements[]>> {
    let result : Result<ODRLContract, Requirements[]>;
    let contract: ODRLContract | undefined;

    // Check contract availability
    try {
      contract = this.contractManager.findContract(ticket)
    } catch (e) {
      this.logger.debug(`Error: ${createErrorMessage(e)}`);
    }

    this.logger.debug(`Contract retrieval attempt ${JSON.stringify(contract)}`);

    if (contract) {
      result = Success(contract)
      this.logger.debug(`Existing contract discovered ${JSON.stringify(contract)}`);
    } else {
      this.logger.debug(`No existing contract discovered. Attempting to resolve ticket.`)

      const resolved = await this.ticketingStrategy.resolveTicket(ticket);
      this.logger.debug(`Resolved ticket. ${JSON.stringify(resolved)}`);

      if (resolved.success) {
        this.logger.debug('Ticket resolved succesfully.')
        // todo: get necessary information here for contract creation
        contract = this.contractManager.createContract(resolved.value)
        result = Success(contract);

        this.logger.debug('New contract created')
        this.logger.debug(JSON.stringify(contract, null, 2))
      }
      else {
        this.logger.debug('Ticket not resolved.')
        result = resolved
      }
    }
    return result;
  }

  // TODO: name
  protected async toResponse(contract: ODRLContract): Promise<DialogOutput> {

    this.logger.debug(JSON.stringify(contract, null, 2))

    // todo: set resource scopes according to contract!
    // Using a map first as the contract could return multiple entries for the same resource_id
    // as it only allows 1 action per entry.
    const permissionMap: Record<string, Permission> = {};
    for (const permission of contract.permission) {
      const id = convertStringOrJsonLdIdentifierToString(permission.target as StringOrJsonLdIdentifier);
      if (!permissionMap[id]) {
        permissionMap[id] = {
          // We do not accept AssetCollections as targets of an UMA access request formatted as an ODRL request!
          resource_id: id,
          resource_scopes: [ // mapping from ODRL to internal CSS read permission
            switchODRLandCSSPermission(convertStringOrJsonLdIdentifierToString(permission.action))
          ]
        };
      } else {
        permissionMap[id].resource_scopes.push(
          switchODRLandCSSPermission(convertStringOrJsonLdIdentifierToString(permission.action))
        );
      }
    }
    let permissions: Permission[] = Object.values(permissionMap);
    this.logger.debug(`granting permissions: ${JSON.stringify(permissions)}`);

    // Create response
    const tokenContents: AccessToken = { permissions, contract }

    this.logger.debug(`resolved result ${JSON.stringify(contract)}`);

    const { token, tokenType } = await this.tokenFactory.serialize(tokenContents);

    this.logger.debug(`Minted token ${JSON.stringify(token)}`);

    // TODO:: test logging
    // this.operationLogger.addLogEntry(serializePolicyInstantiation())

    // Store created instantiated policy (above contract variable) in the pod storage as an instantiated policy
    // todo: dynamic URL
    // todo: fix instantiated from url
    // contract['http://www.w3.org/ns/prov#wasDerivedFrom'] = [ 'urn:ucp:be-gov:policy:d81b8118-af99-4ab3-b2a7-63f8477b6386 ']
    // TODO: test-private error: this container does not exist and unauth does not have append perms
    try {
      const instantiatedPolicyContainer = 'http://localhost:3000/ruben/settings/policies/instantiated/';
      const policyCreationResponse = await fetch(instantiatedPolicyContainer, {
        method: 'POST',
        headers: { 'content-type': 'application/ld+json' },
        body: JSON.stringify(contract),
      });

      if (policyCreationResponse.status !== 201) {
        this.logger.warn(`Adding the contract to the instantiated policies failed: ${
          policyCreationResponse.status} - ${await policyCreationResponse.text()}`);
      }
    } catch (error: unknown) {
      this.logger.warn(`Adding the contract to the instantiated policies failed: ${createErrorMessage(error)}`);
    }

    // TODO:: dynamic contract link to stored signed contract.
    // If needed we can always embed here directly into the return JSON
    return ({
      access_token: token,
      token_type: tokenType,
    });
  }
}
