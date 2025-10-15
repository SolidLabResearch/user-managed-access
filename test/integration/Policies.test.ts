import { App } from '@solid/community-server';
import { ODRL } from '@solidlab/ucp';
import { setGlobalLoggerFactory, WinstonLoggerFactory } from 'global-logger-factory';
import { DataFactory as DF, Parser, Store } from 'n3';
import path from 'node:path';
import {
  badPolicy1,
  changePolicy1,
  changePolicy95e,
  policyA,
  policyB,
  policyC,
  putPolicyB
} from '../../scripts/util/policyExamples';
import { getDefaultCssVariables, getPorts, instantiateFromConfig } from '../util/ServerUtil';
import { findTokenEndpoint, noTokenFetch } from '../util/UmaUtil';

const [ cssPort, umaPort ] = getPorts('Policies');

let tokenEndpoint: string;
const policyEndpoint = `http://localhost:${umaPort}/uma/policies`;
const policyId95e = 'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc'

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
    headers: { authorization: webId, 'content-type': patch ? 'application/sparql-update' : 'text/turtle' },
    ... data ? { body: data } : {},
  });
}

describe('A policy server setup', (): void => {
  const target = `http://localhost:${cssPort}/alice/foo`;
  const webIds = {
    a: 'https://pod.a.com/profile/card#me',
    b: 'https://pod.b.com/profile/card#me',
    c: 'https://pod.c.com/profile/card#me',
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
    await expect(attemptRequest(target, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: 'test' }))
      .resolves.toBe(false);
  });

  it('requires policy creator to be the assigner when POSTing policies.', async(): Promise<void> => {
    let response = await fetchPolicy('POST', webIds.a, undefined, policyB);
    expect(response.status).toBe(403);

    response = await fetchPolicy('POST', webIds.b, undefined, badPolicy1);
    expect(response.status).toBe(403);

    response = await fetchPolicy('POST', webIds.a, undefined, policyA);
    expect(response.status).toBe(201);

    response = await fetchPolicy('POST', webIds.b, undefined, policyB);
    expect(response.status).toBe(201);

    response = await fetchPolicy('POST', webIds.c, undefined, policyC);
    expect(response.status).toBe(201);
  });

  it('can PUT policies', async(): Promise<void> => {
    let response = await fetchPolicy('PUT', webIds.a, policyId95e, putPolicyB);
    expect(response.status).toBe(403);

    // TODO: ID here does not match policy ID but would still work
    // response = await fetchPolicy('PUT', webIds.b, policyId95e + wrong, putPolicyB);
    // expect(response.status).toBe(400);

    response = await fetchPolicy('PUT', webIds.b, policyId95e, putPolicyB);
    expect(response.status).toBe(204);
  });

  it('can show a user their policies.', async(): Promise<void> => {
    let response = await fetch(policyEndpoint);
    expect(response.status).toBe(401);

    response = await fetchPolicy('GET', webIds.a);
    expect(response.status).toBe(200);
    let store = new Store(new Parser().parse(await response.text()));
    let policies = store.getSubjects(ODRL.terms.uid, null, null);
    expect(policies.map((term) => term.value).sort()).toEqual([
      'http://example.org/usagePolicy1',
      'http://example.org/usagePolicy1a',
      'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc',
    ]);
    let rules = store.getObjects(
      DF.namedNode('urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc'), ODRL.terms.permission, null);
    // TODO: should be only 1 element as we should not leak IDs of other peoples rules
    expect(rules.map((rule) => rule.value).sort()).toEqual([
      'urn:uuid:69d57d36-74e5-443c-bae5-30159b0cbd3e', 'urn:uuid:f5199b0a-d824-45a0-bc08-1caa8d19a001'
    ]);
    expect(store.getObjects(DF.namedNode('urn:uuid:f5199b0a-d824-45a0-bc08-1caa8d19a001'), null, null).length)
      .toBeGreaterThan(0);
    expect(store.getObjects(DF.namedNode('urn:uuid:69d57d36-74e5-443c-bae5-30159b0cbd3e'), null, null)).toHaveLength(0);

    response = await fetchPolicy('GET', webIds.b);
    expect(response.status).toBe(200);
    store = new Store(new Parser().parse(await response.text()));
    policies = store.getSubjects(ODRL.terms.uid, null, null);
    expect(policies.map((term) => term.value).sort()).toEqual([
      'http://example.org/usagePolicy2',
      'http://example.org/usagePolicy2a',
      'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc',
    ]);
    rules = store.getObjects(
      DF.namedNode('urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc'), ODRL.terms.permission, null);
    // TODO: should be only 1 element as we should not leak IDs of other peoples rules
    expect(rules.map((rule) => rule.value).sort()).toEqual([
      'urn:uuid:69d57d36-74e5-443c-bae5-30159b0cbd3e', 'urn:uuid:f5199b0a-d824-45a0-bc08-1caa8d19a001'
    ]);
    expect(store.getObjects(DF.namedNode('urn:uuid:f5199b0a-d824-45a0-bc08-1caa8d19a001'), null, null)).toHaveLength(0);
    expect(store.getObjects(DF.namedNode('urn:uuid:69d57d36-74e5-443c-bae5-30159b0cbd3e'), null, null).length)
      .toBeGreaterThan(0);

    response = await fetchPolicy('GET', webIds.c);
    expect(response.status).toBe(200);
    store = new Store(new Parser().parse(await response.text()));
    policies = store.getSubjects(ODRL.terms.uid, null, null);
    expect(policies.map((term) => term.value)).toEqual([
      'http://example.org/usagePolicy3',
    ]);
  });

  it('can return individual policies.', async(): Promise<void> => {
    let response = await fetchPolicy('GET', webIds.a, 'http://example.org/usagePolicy1');
    expect(response.status).toBe(200);
    let store = new Store(new Parser().parse(await response.text()));
    let policies = store.getSubjects(ODRL.terms.uid, null, null);
    expect(policies.map((term) => term.value)).toEqual([ 'http://example.org/usagePolicy1' ]);

    response = await fetchPolicy('GET', webIds.a, 'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc');
    expect(response.status).toBe(200);
    store = new Store(new Parser().parse(await response.text()));
    policies = store.getSubjects(ODRL.terms.uid, null, null);
    expect(policies.map((term) => term.value)).toEqual([ 'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc' ]);
    let rules = store.getObjects(
      DF.namedNode('urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc'), ODRL.terms.permission, null);
    // TODO: should be only 1 element as we should not leak IDs of other peoples rules
    expect(rules.map((rule) => rule.value).sort()).toEqual([
      'urn:uuid:69d57d36-74e5-443c-bae5-30159b0cbd3e', 'urn:uuid:f5199b0a-d824-45a0-bc08-1caa8d19a001'
    ]);
    expect(store.getObjects(DF.namedNode('urn:uuid:f5199b0a-d824-45a0-bc08-1caa8d19a001'), null, null).length)
      .toBeGreaterThan(0);
    expect(store.getObjects(DF.namedNode('urn:uuid:69d57d36-74e5-443c-bae5-30159b0cbd3e'), null, null)).toHaveLength(0);

    response = await fetchPolicy('GET', webIds.b, 'http://example.org/usagePolicy1');
    expect(response.status).toBe(200);
    expect(await response.text()).toHaveLength(0);

    response = await fetchPolicy('GET', webIds.b, 'unknown');
    expect(response.status).toBe(200);
    expect(await response.text()).toHaveLength(0);
  });

  it('can PATCH policies.', async(): Promise<void> => {
    let response = await fetchPolicy('PATCH', webIds.b, 'http://example.org/usagePolicy1', changePolicy1, true);
    expect(response.status).toBe(403);

    response = await fetchPolicy('PATCH', webIds.a, 'http://example.org/usagePolicy1', changePolicy1, true);
    expect(response.status).toBe(204);
    response = await fetchPolicy('GET', webIds.a, 'http://example.org/usagePolicy1');
    expect(response.status).toBe(200);
    let store = new Store(new Parser().parse(await response.text()));
    let policies = store.getSubjects(ODRL.terms.uid, null, null);
    expect(policies.map((term) => term.value)).toEqual([ 'http://example.org/usagePolicy1' ]);
    let rules = store.getObjects(
      DF.namedNode('http://example.org/usagePolicy1'), ODRL.terms.permission, null);
    expect(rules.map((rule) => rule.value)).toEqual([ 'http://example.org/permission100' ]);

    response = await fetchPolicy(
      'PATCH', webIds.a, 'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc', changePolicy95e, true);
    expect(response.status).toBe(204);
    response = await fetchPolicy('GET', webIds.a, 'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc');
    expect(response.status).toBe(200);
    store = new Store(new Parser().parse(await response.text()));
    policies = store.getSubjects(ODRL.terms.uid, null, null);
    expect(policies.map((term) => term.value)).toEqual([ 'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc' ]);
    rules = store.getObjects(
      DF.namedNode('urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc'), ODRL.terms.permission, null);
    // TODO: should only be the last two identifiers
    expect(rules.map((rule) => rule.value).sort())
      .toEqual([ 'urn:uuid:69d57d36-74e5-443c-bae5-30159b0cbd3e',
        'urn:uuid:a1111111-2222-3333-4444-555555555555',
        'urn:uuid:b6666666-7777-8888-9999-aaaaaaaaaaaa' ]);

    // Rules in above policy assigned by b should still be there
    response = await fetchPolicy('GET', webIds.b, 'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc');
    expect(response.status).toBe(200);
    store = new Store(new Parser().parse(await response.text()));
    policies = store.getSubjects(ODRL.terms.uid, null, null);
    expect(policies.map((term) => term.value)).toEqual([ 'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc' ]);
    expect(store.getObjects(DF.namedNode('urn:uuid:69d57d36-74e5-443c-bae5-30159b0cbd3e'), null, null).length)
      .toBeGreaterThan(0);
  });

  it('can delete policies.', async(): Promise<void> => {
    // This does nothing as it is the wrong user
    let response = await fetchPolicy('DELETE', webIds.b, 'http://example.org/usagePolicy1');
    expect(response.status).toBe(204);
    response = await fetchPolicy('GET', webIds.a, 'http://example.org/usagePolicy1');
    expect(response.status).toBe(200);
    expect((await response.text()).length).toBeGreaterThan(0);

    response = await fetchPolicy('DELETE', webIds.a, 'http://example.org/usagePolicy1');
    expect(response.status).toBe(204);
    response = await fetchPolicy('GET', webIds.a, 'http://example.org/usagePolicy1');
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toHaveLength(0);

    response = await fetchPolicy('DELETE', webIds.a, 'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc');
    expect(response.status).toBe(204);
    response = await fetchPolicy('GET', webIds.a, 'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc');
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toHaveLength(0);

    // TODO: below should work but currently does not
    // Rules in above policy assigned by b should still be there
    // response = await fetchPolicy('GET', webIds.b, 'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc');
    // expect(response.status).toBe(200);
    // console.log(await response.text());
    // let store = new Store(new Parser().parse(await response.text()));
    // let policies = store.getSubjects(ODRL.terms.uid, null, null);
    // expect(policies.map((term) => term.value)).toEqual([ 'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc' ]);
    // expect(store.getObjects(DF.namedNode('urn:uuid:69d57d36-74e5-443c-bae5-30159b0cbd3e'), null, null).length)
    //   .toBeGreaterThan(0);
  });
});
