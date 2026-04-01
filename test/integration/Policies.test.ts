import { App } from '@solid/community-server';
import { ODRL } from '@solidlab/uma';
import { setGlobalLoggerFactory, WinstonLoggerFactory } from 'global-logger-factory';
import { Parser, Store } from 'n3';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { getDefaultCssVariables, getPorts, instantiateFromConfig } from '../util/ServerUtil';
import { findTokenEndpoint, generateCredentials, noTokenFetch } from '../util/UmaUtil';

const [ cssPort, umaPort ] = getPorts('Policies');

let tokenEndpoint: string;
const policyEndpoint = `http://localhost:${umaPort}/uma/policies`;

/**
 * Tries to go through the entire UMA negotiation to access a resource.
 * Returns true or false depending on if a token is received.
 * Errors if something unexpected happens,
 * such as a 500 response, or the initial request already succeeding.
 */
async function attemptRequest(target: string, init?: RequestInit, webId?: string): Promise<boolean> {
  // Parse ticket and UMA server URL from header
  const parsedHeader = await noTokenFetch(target, init);

  // Find UMA server token endpoint
  if (!tokenEndpoint) {
    tokenEndpoint = await findTokenEndpoint(parsedHeader.as_uri);
  }

  // Send ticket request to UMA server
  const content: Record<string, string> = {
    grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
    ticket: parsedHeader.ticket,
  };
  if (webId) {
    content.claim_token = encodeURIComponent(webId);
    content.claim_token_format = 'urn:solidlab:uma:claims:formats:webid';
  }

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(content),
  });
  expect(response.status).toBeLessThan(500);

  return response.status < 300;
}

async function fetchPolicy(method: string, webId: string, id?: string, data?: string, patch = false):
  Promise<Response> {
  return fetch(policyEndpoint + (id ? `/${encodeURIComponent(id)}` : ''), {
    method,
    headers: {
      authorization: `WebID ${encodeURIComponent(webId)}`,
      'content-type': patch ? 'application/sparql-update' : 'text/turtle'
    },
    ... data ? { body: data } : {},
  });
}

describe('A policy server setup', (): void => {
  const owner = `http://localhost:${cssPort}/alice/profile/card#me`;
  const other = 'http://example.org/bob/profile/card#me';
  const root = `http://localhost:${cssPort}/alice/`;
  const target = `http://localhost:${cssPort}/alice/README`;
  let policyId: string;
  let ruleId: string;

  function generatePolicy(params: {
    target?: string,
    assignee?: string,
    assigner?: string,
    policyId?: string,
    ruleId?: string,
  }): string {
    params = {
      target: target,
      assignee: other,
      assigner: owner,
      ... params
    };
    const policyId = params.policyId ?? `http://example.org/${randomUUID()}`;
    const ruleId = params.ruleId ?? `http://example.org/${randomUUID()}`;
    const constraintId = `http://example.org/${randomUUID()}`;
    return `
      @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
      @prefix dct: <http://purl.org/dc/terms/> .
      
      <${policyId}> a odrl:Agreement ;
        odrl:uid <${policyId}> ;
        odrl:permission <${ruleId}> .
      <${ruleId}>
        a odrl:Permission ;
        odrl:action odrl:modify ;
        odrl:target <${params.target}> ;
        odrl:assignee <${params.assignee}> ;
        odrl:assigner <${params.assigner}> ;
        odrl:constraint <${constraintId}> .
      <${constraintId}>
        odrl:leftOperand odrl:purpose ;
        odrl:operator odrl:eq ;
        odrl:rightOperand <http://example.org/purpose> .
    `;
  }

  let umaApp: App;
  let cssApp: App;

  beforeAll(async(): Promise<void> => {
    setGlobalLoggerFactory(new WinstonLoggerFactory('off'));

    umaApp = await instantiateFromConfig(
      'urn:uma:default:App',
      path.join(__dirname, '../../packages/uma/config/default.json'),
      {
        'urn:uma:variables:port': umaPort,
        'urn:uma:variables:baseUrl': `http://localhost:${umaPort}/uma`,
        'urn:uma:variables:eyePath': 'eye',
        'urn:uma:variables:backupFilePath': '',
      }
    ) as App;

    cssApp = await instantiateFromConfig(
      'urn:solid-server:default:App',
      path.join(__dirname, '../../packages/css/config/default.json'),
      {
        ...getDefaultCssVariables(cssPort),
        'urn:solid-server:uma:variable:AuthorizationServer': `http://localhost:${umaPort}/`,
        'urn:solid-server:default:variable:seedConfig': path.join(__dirname, '../../packages/css/config/seed.json'),
      },
    ) as App;

    await Promise.all([umaApp.start(), cssApp.start()]);
  });

  afterAll(async(): Promise<void> => {
    await Promise.all([umaApp.stop(), cssApp.stop()]);
  });

  it('can not create a resource without access.', async(): Promise<void> => {
    await generateCredentials({
      webId: owner,
      authorizationServer: `http://localhost:${umaPort}/uma`,
      resourceServer: `http://localhost:${cssPort}/`,
      email: 'alice@example.org',
      password: 'abc123'
    });

    await expect(attemptRequest(target, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: 'test' }))
      .resolves.toBe(false);
  });

  it('requires policy creator to be the assigner and target owner when POSTing policies.', async(): Promise<void> => {
    // Doing fetch to make sure the resource is registered
    await fetch(root);
    let response = await fetchPolicy('POST', other, undefined, generatePolicy({ target: root }));
    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toContain('The assigner needs to match the request credentials');

    response = await fetchPolicy('POST', other, undefined,
      generatePolicy({ target: root, assigner: other }));
    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toContain('The assigner needs to be the owner of the target');
    const missingAssigner = `
      @prefix ex: <http://example.org/> .
      @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
      @prefix dct: <http://purl.org/dc/terms/> .
      
      ex:badPolicy a odrl:Agreement ;
        odrl:uid ex:badPolicy ;
        odrl:permission ex:badPolicyRule .
      ex:badPolicyRule
        a odrl:Permission ;
        odrl:action odrl:modify ;
        odrl:target <${root}> ;
        odrl:assignee <${other}> .
    `;
    response = await fetchPolicy('POST', owner, undefined, missingAssigner);
    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain('"Offer rules require at least 1 assigner and assignee');

    // TODO: could generate many other invalid policies

    const goodPolicy = generatePolicy({ target: root });
    response = await fetchPolicy('POST', owner, undefined, goodPolicy);
    // TODO: need to decide what to do with location header
    //       if it stays like this the ID should be encoded though
    policyId = response.headers.get('location')!.slice(`http://localhost:${umaPort}/uma/policies/`.length);
    expect(response.status).toBe(201);
  });

  // TODO: should read out the above policy here

  it('can PUT policies', async(): Promise<void> => {
    // Not the owner/assigner so can't change
    let response = await fetchPolicy('PUT', other, policyId, generatePolicy({ target: root, policyId }));
    expect(response.status).toBe(403);

    const updatedPolicy = generatePolicy({ target, policyId });
    response = await fetchPolicy('PUT', owner, policyId + 'wrong', updatedPolicy);
    expect(response.status).toBe(404);

    response = await fetchPolicy('PUT', owner, policyId, updatedPolicy);
    expect(response.status).toBe(204);
  });

  // TODO: and then here check if it got changed

  it('can show a user their policies.', async(): Promise<void> => {
    let response = await fetch(policyEndpoint);
    expect(response.status).toBe(401);

    response = await fetchPolicy('GET', other);
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toEqual('');

    response = await fetchPolicy('GET', owner);
    let store = new Store(new Parser().parse(await response.text()));
    let policies = store.getSubjects(ODRL.terms.uid, null, null);
    expect(policies.map((term) => term.value).sort()).toEqual([ policyId ]);
    let rules = store.getObjects(policyId, ODRL.terms.permission, null);
    expect(rules.length).toBe(1);
    expect(store.getObjects(rules[0], null, null).length).toBeGreaterThan(0);
    // TODO: match the full policy here
  });

  it('can return individual policies.', async(): Promise<void> => {
    let response = await fetchPolicy('GET', owner, policyId);
    expect(response.status).toBe(200);
    let store = new Store(new Parser().parse(await response.text()));
    let policies = store.getSubjects(ODRL.terms.uid, null, null);
    expect(policies.map((term) => term.value)).toEqual([ policyId ]);
    // TODO: check other policy contents here
    // TODO: should have at least 2 policies/rules before going into the extensive GET tests

    // Need rule ID for PATCH test below
    const rules = store.getObjects(policyId, ODRL.terms.permission, null);
    expect(rules).toHaveLength(1);
    ruleId = rules[0].value;

    response = await fetchPolicy('GET', other, policyId);
    expect(response.status).toBe(403);

    response = await fetchPolicy('GET', owner, 'http://example.org/unknown');
    expect(response.status).toBe(404);
  });

  it('can PATCH policies.', async(): Promise<void> => {
    const newRuleId = `http://example.org/${randomUUID()}`;
    const changePolicy = `
      PREFIX odrl: <http://www.w3.org/ns/odrl/2/>
      
      DELETE {
        <${policyId}> odrl:permission <${ruleId}> .
        <${ruleId}> a odrl:Permission ;
                    odrl:action odrl:modify ;
                    odrl:target <${target}> ;
                    odrl:assignee <${other}> ;
                    odrl:assigner <${owner}> .
      }
      INSERT {
        <${policyId}> odrl:permission <${newRuleId}> .
        <${newRuleId}> a odrl:Permission ;
                       odrl:action odrl:read ;
                       odrl:target <${target}> ;
                       odrl:assignee <${other}> ;
                       odrl:assigner <${owner}> .
      }
      WHERE {
        <${policyId}> odrl:permission <${ruleId}> .
      }`;
    let response = await fetchPolicy('PATCH', other, policyId, changePolicy, true);
    expect(response.status).toBe(403);

    response = await fetchPolicy('PATCH', owner, policyId, changePolicy, true);
    expect(response.status).toBe(204);

    // TODO: check contents of policy now
    // TODO: check patch where one of multiple rules gets changed, to make sure other one is gone
    // TODO: this can create dangling rules/constraints/etc. -> clean up
  });

  it('can delete policies.', async(): Promise<void> => {
    // This does nothing as it is the wrong user
    let response = await fetchPolicy('DELETE', other, policyId);
    expect(response.status).toBe(403);
    response = await fetchPolicy('GET', owner, policyId);
    expect(response.status).toBe(200);
    expect((await response.text()).length).toBeGreaterThan(0);

    response = await fetchPolicy('DELETE', owner, policyId);
    expect(response.status).toBe(204);
    response = await fetchPolicy('GET', owner, policyId);
    expect(response.status).toBe(404);
  });

  it('can add and read policies with blank nodes.', async(): Promise<void> => {
    const policy = `
      @prefix ex: <http://example.org/> .
      @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
      @prefix dct: <http://purl.org/dc/terms/> .
      
      _:a a odrl:Agreement ;
        odrl:uid _:a ;
        odrl:permission [
          a odrl:Permission ;
          odrl:action odrl:modify ;
          odrl:target <${target}> ;
          odrl:assignee <${other}> ;
          odrl:assigner <${owner}> ;
          odrl:constraint [
            odrl:leftOperand odrl:purpose ;
            odrl:operator odrl:eq ;
            odrl:rightOperand <http://example.org/purpose> 
          ]
      ].`;
    let response = await fetchPolicy('POST', owner, undefined, policy);
    expect(response.status).toBe(201);

    response = await fetch(response.headers.get('location')!, {
      headers: { authorization: `WebID ${encodeURIComponent(owner)}` },
    });
    expect(response.status).toBe(200);
  });
});
