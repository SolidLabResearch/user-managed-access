import {
  BadRequestHttpError,
  createErrorMessage,
  ForbiddenHttpError,
  getLoggerFor,
  HttpErrorClass,
  KeyValueStorage
} from '@solid/community-server';
import { v4 } from 'uuid';
import { AccessToken, Permission, Requirements } from '..';
import { Verifier } from '../credentials/verify/Verifier';
import { NeedInfoError } from '../errors/NeedInfoError';
import { ContractManager } from '../policies/contracts/ContractManager';
import { TicketingStrategy } from '../ticketing/strategy/TicketingStrategy';
import { Ticket } from '../ticketing/Ticket';
import { TokenFactory } from '../tokens/TokenFactory';
import { processRequestPermission, switchODRLandCSSPermission } from '../util/rdf/RequestProcessing';
import { Result, Success } from '../util/Result';
import { reType } from '../util/ReType';
import { convertStringOrJsonLdIdentifierToString, ODRLContract, StringOrJsonLdIdentifier } from '../views/Contract';
import { DialogInput } from './Input';
import { Negotiator } from './Negotiator';
import { DialogOutput } from './Output';


/**
 * A mocked Negotiator for demonstration purposes to display contract negotiation
 */
export class ContractNegotiator implements Negotiator {
  protected readonly logger = getLoggerFor(this);

  // protected readonly operationLogger = getOperationLogger();
  protected readonly contractManager = new ContractManager();

  /**
   * Construct a new Negotiator
   * @param verifier - The Verifier used to verify Claims of incoming Credentials.
   * @param ticketStore - A KeyValueStore to track Tickets.
   * @param ticketManager - The strategy describing the life cycle of a Ticket.
   * @param tokenFactory - A factory for minting Access Tokens.
   */
  public constructor(
    protected verifier: Verifier,
    protected ticketStore: KeyValueStorage<string, Ticket>,
    protected ticketingStrategy: TicketingStrategy,
    protected tokenFactory: TokenFactory,
  ) {
    this.logger.warn('The Contract Negotiator is for demonstration purposes only! DO NOT USE THIS IN PRODUCTION !!!')
  }

  /**
   * Performs UMA grant negotiation.
   *
   * @param {TokenRequest} body - request body
   * @param {HttpHandlerContext} context - request context
   * @return {Promise<TokenResponse>} tokens - yielded tokens
   */
  public async negotiate(input: DialogInput): Promise<DialogOutput> {
    reType(input, DialogInput);
    if (!input.permissions && input.permission?.length)
      input.permissions = input.permission.map(p => processRequestPermission(p))
    this.logger.debug(`Input. ${JSON.stringify(input)}`);
    // Create or retrieve ticket
    const ticket = await this.getTicket(input);
    this.logger.debug(`Processing ticket. ${JSON.stringify(ticket)}`);

    // Process pushed credentials
    const updatedTicket = await this.processCredentials(input, ticket);
    this.logger.debug(`Processed credentials ${JSON.stringify(updatedTicket)}`);

    let result : Result<ODRLContract, Requirements[]>
    let contract: ODRLContract | undefined;

    // Check contract availability
    try {
      contract = this.contractManager.findContract(updatedTicket)
    } catch (e) {
      this.logger.debug(`Error: ${createErrorMessage(e)}`);
    }

    this.logger.debug(`Contract retrieval attempt ${JSON.stringify(contract)}`);

    if (contract) {
      result = Success(contract)
      this.logger.debug(`Existing contract discovered ${JSON.stringify(contract)}`);
    } else {
      this.logger.debug(`No existing contract discovered. Attempting to resolve ticket.`)

      const resolved = await this.ticketingStrategy.resolveTicket(updatedTicket);
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

    if (result.success) {
      let contract : ODRLContract = result.value

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

      this.logger.debug(`resolved result ${JSON.stringify(result)}`);

      const { token, tokenType } = await this.tokenFactory.serialize(tokenContents);

      this.logger.debug(`Minted token ${JSON.stringify(token)}`);

      // TODO:: test logging
      // this.operationLogger.addLogEntry(serializePolicyInstantiation())

      // Store created instantiated policy (above contract variable) in the pod storage as an instantiated policy
      // todo: dynamic URL
      // todo: fix instantiated from url
      // contract['http://www.w3.org/ns/prov#wasDerivedFrom'] = [ 'urn:ucp:be-gov:policy:d81b8118-af99-4ab3-b2a7-63f8477b6386 ']
      // TODO: test-private error: this container does not exist and unauth does not have append perms
      const instantiatedPolicyContainer = 'http://localhost:3000/ruben/settings/policies/instantiated/';
      const policyCreationResponse = await fetch(instantiatedPolicyContainer, {
        method: 'POST',
        headers: { 'content-type': 'application/ld+json' },
        body: JSON.stringify(contract, null, 2)
      });

      if (policyCreationResponse.status !== 201) { this.logger.warn('Adding a policy did not succeed...') }

      // TODO:: dynamic contract link to stored signed contract.
      // If needed we can always embed here directly into the return JSON
      return ({
        access_token: token,
        token_type: tokenType,
      });
    }

    // ... on failure, deny if no solvable requirements
    const requiredClaims = ticket.required.map(req => Object.keys(req));
    if (requiredClaims.length === 0) throw new ForbiddenHttpError();

    // ... require more info otherwise
    const id = v4();
    this.ticketStore.set(id, ticket);
    throw new NeedInfoError('Need more info to authorize request ...', id, {
      required_claims: {
        claim_token_format: requiredClaims,
      },
    });
  }

  /**
   * Helper function that retrieves a Ticket from the TicketStore if it exists,
   * or initializes a new one otherwise.
   *
   * @param input - The input of the negotiation dialog.
   *
   * @returns The Ticket describing the dialog at hand.
   */
  private async getTicket(input: DialogInput): Promise<Ticket> {
    const { ticket, permission, permissions } = input;

    if (ticket) {
      const stored = await this.ticketStore.get(ticket);
      if (!stored) this.error(BadRequestHttpError, 'The provided ticket is not valid.');

      await this.ticketStore.delete(ticket);
      return stored;
    }

    if (!permissions) {
      this.error(BadRequestHttpError, 'A token request without existing ticket should include requested permissions.');
    }

    return await this.ticketingStrategy.initializeTicket(permissions);
  }

  /**
   * Helper function that checks for the presence of Credentials and, if present,
   * verifies them and validates them in context of the provided Ticket.
   *
   * @param input - The input of the negotiation dialog.
   * @param ticket - The Ticket against which to validate any Credentials.
   *
   * @returns An updated Ticket in which the Credentials have been validated.
   */
  private async processCredentials(input: DialogInput, ticket: Ticket): Promise<Ticket> {
    const { claim_token: token, claim_token_format: format } = input;

    if (token || format) {
      if (!token) this.error(BadRequestHttpError, 'Request with a "claim_token_format" must contain a "claim_token".');
      if (!format) this.error(BadRequestHttpError, 'Request with a "claim_token" must contain a "claim_token_format".');

      const claims = await this.verifier.verify({ token, format });

      return await this.ticketingStrategy.validateClaims(ticket, claims);
    }

    return ticket;
  }

  /**
   * Logs and throws an error
   *
   * @param {HttpErrorClass} constructor - The error constructor.
   * @param {string} message - The error message.
   *
   * @throws An Error constructed with the provided constructor with the
   * provided message
   */
  private error(constructor: HttpErrorClass, message: string): never {
    this.logger.warn(message);
    throw new constructor(message);
  }
}
