import {
  BadRequestHttpError,
  ForbiddenHttpError,
  joinUrl,
  KeyValueStorage,
  NotFoundHttpError,
} from '@solid/community-server';
import { DataFactory as DF, Parser, Store } from 'n3';
import { randomUUID } from 'node:crypto';
import { ODRL } from 'odrl-evaluator';
import { UCRulesStorage } from '../ucp/storage/UCRulesStorage';
import { DC, RDF } from '../ucp/util/Vocabularies';
import { HttpHandlerResponse } from '../util/http/models/HttpHandler';
import { ParsedPolicy, PolicyParser } from '../util/PolicyParser';
import { patchPolicy, queryEngine } from '../util/routeSpecific';
import { BaseController } from './BaseController';

// TODO: make sure to let partners know early if policy API changes

/**
 * Controller for routes concerning policies and related rules
 */
export class PolicyController extends BaseController {
  constructor(
    protected readonly baseUrl: string,
    protected readonly policySuffix: string,
    protected readonly store: UCRulesStorage,
    protected readonly ownershipStore: KeyValueStorage<string, string[]>,
  ) {
    super(
      store,
      null as any,
      null as any,
      null as any,
      null as any,
      patchPolicy,
    );
    this.sanitizeGet = this.getSinglePolicy.bind(this);
    this.sanitizeGets = this.getAllPolicies.bind(this);
    this.sanitizePost = this.addPolicy.bind(this);
    this.sanitizeDelete = this.deletePolicy.bind(this);
  }

  // TODO: for all functions: investigate similarities with access request controller and determine better ways to mitigate duplicaton

  // TODO: something to target rules in a policy specifically?

  public async putEntity(data: string, policyId: string, clientId: string): Promise<{ status: number }> {
    // Overriding this function as doing a new POST would rename the policy
    const store = new Store(new Parser().parse(data));

    // TODO: same stuff as POST without rename, and delete old data

    // TODO: could catch 404 and allow creating new policies at fixed IDs
    // Will throw a 404/403 if one of the parameters is incorrect
    const globalStore = await this.store.getStore();
    const originalPolicy = await this.getSinglePolicy(globalStore, policyId, clientId);

    // TODO: fully duplicated from POST
    const parser = new PolicyParser(store);
    const result = parser.doStuffTODO();

    // Not copying the creator triple as it is always added anyway, but still need to verify
    const creatorQuads = result.quads.filter(quad => quad.predicate.equals(DC.terms.creator));
    if (creatorQuads.length > 1 || (creatorQuads.length === 1 && creatorQuads[0].object.value !== clientId)) {
      throw new BadRequestHttpError('Policy creator does not match user credentials');
    } else if (creatorQuads.length === 0) {
      // Add creator triple
      result.quads.push(DF.quad(result.root, DC.terms.creator, DF.namedNode(clientId)));
    }

    // Validate ownership requirements
    const owned = await this.ownershipStore.get(clientId) ?? [];
    for (const { assigners, targets } of result.ruleData) {
      if (assigners.length !== 1 || assigners[0].value !== clientId) {
        throw new ForbiddenHttpError('The assigner needs to match the request credentials');
      }
      for (const target of targets) {
        // Target could also be a collection
        if (!owned.includes(target.value) && globalStore.countQuads(target, DC.terms.creator, clientId, null) === 0) {
          throw new ForbiddenHttpError('The assigner needs to be the owner of the target');
        }
      }
    }

    const resultStore = new Store(result.quads);

    // TODO: now replace original policy with the new one (this is very similar to patch)
    const add = resultStore.difference(originalPolicy);
    const remove = originalPolicy.difference(resultStore);

    if (add.size > 0) {
      await this.store.addRule(add as Store);
    }
    if (remove.size > 0) {
      await this.store.removeData(remove as Store);
    }

    return { status: 204 };
  }

  // TODO: type can be buffer or string, need to check higher level as well
  // TODO: overriding as otherwise it's not sure if we're getting isolated data or not
  // TODO: will be similar to access requests though
  public async patchEntity(policyId: string, patch: Buffer | string, clientId: string): Promise<HttpHandlerResponse<string>> {
    // Will throw a 404/403 if one of the parameters is incorrect
    const globalStore = await this.store.getStore();
    const originalPolicy = await this.getSinglePolicy(globalStore, policyId, clientId);

    await queryEngine.queryVoid(patch.toString(), { sources: [originalPolicy] });
    // TODO: now validate if the result is still a valid policy

    // TODO: fully duplicated from PUT
    const parser = new PolicyParser(originalPolicy);
    const result = parser.doStuffTODO();

    // Not copying the creator triple as it is always added anyway, but still need to verify
    const creatorQuads = result.quads.filter(quad => quad.predicate.equals(DC.terms.creator));
    if (creatorQuads.length > 1 || (creatorQuads.length === 1 && creatorQuads[0].object.value !== clientId)) {
      throw new BadRequestHttpError('Policy creator does not match user credentials');
    } else if (creatorQuads.length === 0) {
      // Add creator triple
      result.quads.push(DF.quad(result.root, DC.terms.creator, DF.namedNode(clientId)));
    }

    // Validate ownership requirements
    const owned = await this.ownershipStore.get(clientId) ?? [];
    for (const { assigners, targets } of result.ruleData) {
      if (assigners.length !== 1 || assigners[0].value !== clientId) {
        throw new ForbiddenHttpError('The assigner needs to match the request credentials');
      }
      for (const target of targets) {
        // Target could also be a collection
        if (!owned.includes(target.value) && globalStore.countQuads(target, DC.terms.creator, clientId, null) === 0) {
          throw new ForbiddenHttpError('The assigner needs to be the owner of the target');
        }
      }
    }

    // TODO: new rules could have been added through PATCH (and also PUT!!!) which would have to be renamed!
    //       ^ sub function that also returns the nodes so we know all the nodes and which ones might be new

    const resultStore = new Store(result.quads);

    // TODO: now replace original policy with the new one (this is very similar to patch)
    const add = resultStore.difference(originalPolicy);
    const remove = originalPolicy.difference(resultStore);

    if (add.size > 0) {
      await this.store.addRule(add as Store);
    }
    if (remove.size > 0) {
      await this.store.removeData(remove as Store);
    }

    return { status: 204 };
  }

  protected getSinglePolicy(store: Store, policyId: string, clientId: string): Promise<Store> {
    return this.getPolicies(store, clientId, policyId);
  }

  protected getAllPolicies(store: Store, clientId: string): Promise<Store> {
    return this.getPolicies(store, clientId);
  }

  // TODO: instead of the ownership checks, we could just check the assigner field...
  protected async getPolicies(store: Store, clientID: string, policyId?: string): Promise<Store> {
    const policyStore = new Store();
    if (policyId) {
      // TODO: bit much to put in single if-block?
      const policyNode = DF.namedNode(policyId);
      policyStore.addQuads(store.getQuads(policyNode, null, null, null));
      if (policyStore.size === 0) {
        throw new NotFoundHttpError();
      }
      if (!policyStore.has(DF.quad(policyNode, DC.terms.creator, DF.namedNode(clientID)))) {
        throw new ForbiddenHttpError();
      }
      return new Store(new PolicyParser(store).doStuffTODO(policyNode).quads);
    } else {
      // Everything created would also include things such as collections
      const created = store.getSubjects(DC.terms.creator, clientID, null);
      const policies = created.filter(policy => {
        const types = store.getObjects(policy, RDF.terms.type, null);
        return types.some(type => [ODRL.terms.Set, ODRL.terms.Offer, ODRL.terms.Agreement]
          .some(policyType => type.equals(policyType)));
      });
      const parser = new PolicyParser(store);
      return new Store(policies.flatMap(policy => parser.doStuffTODO(policy).quads));
    }


    // TODO: for everything below, can just assume data is good because it got added through the API

    // TODO: error if we have dangling rules and/or delete them? or if multiple policies?
    // TODO: do stuff if no rules


    // TODO: if there are no rules for some reason I guess we can just return the empty policy

    // TODO: although this should never happen: remove rule references from policy store that target unowned resources

    // TODO: how to know what to delete though? everything except collections for now?

    // TODO: should just also prevent policies policies from being patched? although might be bad for loama
    //       -> does this just use the current policy PATCH solution?
  }

  // TODO: ID returned should potentially be URL encoded
  protected async addPolicy(store: Store, clientId: string): Promise<{ result: Store, id: string }> {
    const parser = new PolicyParser(store);
    const result = parser.doStuffTODO();

    // Not copying the creator triple as it is always added anyway, but still need to verify
    const creatorQuads = result.quads.filter(quad => quad.predicate.equals(DC.terms.creator));
    if (creatorQuads.length > 1 || (creatorQuads.length === 1 && creatorQuads[0].object.value !== clientId)) {
      throw new BadRequestHttpError('Policy creator does not match user credentials');
    } else if (creatorQuads.length === 0) {
      // Add creator triple
      result.quads.push(DF.quad(result.root, DC.terms.creator, DF.namedNode(clientId)));
    }

    // Validate ownership requirements
    const globalStore = await this.store.getStore();
    const owned = await this.ownershipStore.get(clientId) ?? [];
    for (const { assigners, targets } of result.ruleData) {
      if (assigners.length !== 1 || assigners[0].value !== clientId) {
        throw new ForbiddenHttpError('The assigner needs to match the request credentials');
      }
      for (const target of targets) {
        // Target could also be a collection
        if (!owned.includes(target.value) && globalStore.countQuads(target, DC.terms.creator, clientId, null) === 0) {
          throw new ForbiddenHttpError('The assigner needs to be the owner of the target');
        }
      }
    }

    const renamedResult = this.renamePolicyIdentifiers(result, joinUrl(this.baseUrl, this.policySuffix));

    return { result: new Store(renamedResult.quads), id: renamedResult.root.value };
  }

  // TODO: move more to utilify file?

  // TODO: way to add rules to policy without patch?
  // TODO: for PATCH: first query everything starting from policy node, apply changes, and then call these functions again to verify correctness
  //       ^ but in this case the ID can already exist? maybe? sometimes? not for the new things though

  protected renamePolicyIdentifiers(policy: ParsedPolicy, prefixUrl: string): ParsedPolicy {
    const renameMap = Object.fromEntries(policy.nodes.map(node =>
      [node.value, DF.namedNode(joinUrl(prefixUrl, randomUUID()))]));
    const updatedQuads = policy.quads.map(quad => {
      const updated = [ renameMap[quad.subject.value], renameMap[quad.predicate.value], renameMap[quad.object.value] ];
      if (!updated[0] && !updated[1] && !updated[2]) {
        return quad;
      }
      return DF.quad(updated[0] ?? quad.subject, updated[1] ?? quad.predicate, updated[2] ?? quad.object);
    });

    return {
      quads: updatedQuads,
      nodes: Object.values(renameMap),
      root: renameMap[policy.root.value],
      ruleData: policy.ruleData.map(data => ({
        assigners: data.assigners.map(assigner => renameMap[assigner.value] ?? assigner),
        targets: data.targets.map(target => renameMap[target.value] ?? target),
        actions: data.actions.map(action => renameMap[action.value] ?? action),
      })),
    }
  }

  protected async deletePolicy(store: Store, policyId: string, clientId: string): Promise<void> {
    // This GET check ensures the client is the creator of the policy
    const policy = await this.getSinglePolicy(store, policyId, clientId);
    store.removeQuads(policy.getQuads(null, null, null, null));
  }
}
