import { App, joinUrl } from '@solid/community-server';
import { ODRL } from '@solidlab/uma';
import { setGlobalLoggerFactory, WinstonLoggerFactory } from 'global-logger-factory';
import { Parser, Store, DataFactory as DF } from 'n3';
import path from 'node:path';
import { getDefaultCssVariables, getPorts, instantiateFromConfig } from '../util/ServerUtil';
import { generateCredentials } from '../util/UmaUtil';

const [ cssPort, umaPort ] = getPorts('AccessRequests');

const policyEndpoint = `http://localhost:${umaPort}/uma/policies`;
const accessRequestEndpoint = `http://localhost:${umaPort}/uma/requests`;
const owner = `http://localhost:${cssPort}/alice/profile/card#me`;
const requester = `http://example.com/bob`;
const target = `http://localhost:${cssPort}/alice/`;

describe('An access request server setup', (): void => {
  let umaApp: App;
  let cssApp: App;
  let requestLocation: string;

  beforeAll(async(): Promise<void> => {
    setGlobalLoggerFactory(new WinstonLoggerFactory('off'));

    umaApp = await instantiateFromConfig(
      'urn:uma:default:App',
      path.join(__dirname, '../../packages/uma/config/default.json'),
      {
        'urn:uma:variables:port': umaPort,
        'urn:uma:variables:baseUrl': `http://localhost:${umaPort}/uma`,
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
    await Promise.all([umaApp.stop(), cssApp.start()]);
  });

  it('can set up the resource server.', async(): Promise<void> => {
    await generateCredentials({
      webId: owner,
      authorizationServer: `http://localhost:${umaPort}/uma`,
      resourceServer: `http://localhost:${cssPort}/`,
      email: 'alice@example.org',
      password: 'abc123'
    });
  });

  it('does not have any policies when starting.', async(): Promise<void> => {
    const response = await fetch(policyEndpoint, {
      headers: { authorization: `WebID ${encodeURIComponent(owner)}` },
    });
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('');
  });

  it('can request access.', async(): Promise<void> => {
    const response = await fetch(accessRequestEndpoint, {
      method: 'POST',
      headers: {
        authorization: `WebID ${encodeURIComponent(requester)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ resource_id: target, resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ]}),
    });
    requestLocation = response.headers.get('location')!;
    expect(requestLocation.length).toBeGreaterThan(0);
    await expect(response.status).toBe(201);
  });

  it('can see the access request as the requester.', async(): Promise<void> => {
    let response = await fetch(accessRequestEndpoint, {
      headers: { authorization: `WebID ${encodeURIComponent(requester)}` },
    });
    expect(response.status).toBe(200);
    const parser = new Parser();
    let store = new Store(parser.parse(await response.text()));
    expect(store.countQuads(
      null,
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      'https://w3id.org/force/sotw#EvaluationRequest', null)).toBe(1);

    response = await fetch(requestLocation, {
      headers: { authorization: `WebID ${encodeURIComponent(requester)}` },
    });
    expect(response.status).toBe(200);
    store = new Store(parser.parse(await response.text()));
    expect(store.countQuads(
      null,
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      'https://w3id.org/force/sotw#EvaluationRequest', null)).toBe(1);
  });

  it('can see the access request as the owner.', async(): Promise<void> => {
    // It's possible the target is not registered yet at this point, this fetch makes sure it is
    await fetch(target);

    let response = await fetch(accessRequestEndpoint, {
      headers: { authorization: `WebID ${encodeURIComponent(owner)}` },
    });
    expect(response.status).toBe(200);
    const parser = new Parser();
    let store = new Store(parser.parse(await response.text()));
    expect(store.countQuads(
      null,
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      'https://w3id.org/force/sotw#EvaluationRequest', null)).toBe(1);

    response = await fetch(requestLocation, {
      headers: { authorization: `WebID ${encodeURIComponent(owner)}` },
    });
    expect(response.status).toBe(200);
    store = new Store(parser.parse(await response.text()));
    expect(store.countQuads(
      null,
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      'https://w3id.org/force/sotw#EvaluationRequest', null)).toBe(1);
  });

  it('can not see the access request as someone else.', async(): Promise<void> => {
    let response = await fetch(accessRequestEndpoint, {
      headers: { authorization: `WebID ${encodeURIComponent('http://example.com/unknown')}` },
    });
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('');

    response = await fetch(requestLocation, {
      headers: { authorization: `WebID ${encodeURIComponent('http://example.com/unknown')}` },
    });
    expect(response.status).toBe(403);
  });

  it('can not accept the request as requester.', async(): Promise<void> => {
    const response = await fetch(requestLocation, {
      method: 'PATCH',
      headers: { authorization: `WebID ${encodeURIComponent(requester)}` },
      body: JSON.stringify({ status: 'accepted' }),
    });
    expect(response.status).toBe(403);
  });

  it('can accept the request as owner.', async(): Promise<void> => {
    const response = await fetch(requestLocation, {
      method: 'PATCH',
      headers: { authorization: `WebID ${encodeURIComponent(owner)}`  },
      body: JSON.stringify({ status: 'accepted' }),
    });
    expect(response.status).toBe(204);
  });

  it('can not modify an accepted request.', async(): Promise<void> => {
    const response = await fetch(requestLocation, {
      method: 'PATCH',
      headers: { authorization: `WebID ${encodeURIComponent(owner)}` },
      body: JSON.stringify({ status: 'denied' }),
    });
    expect(response.status).toBe(409);
  });

  it('has a policy after accepting the request.', async(): Promise<void> => {
    const response = await fetch(policyEndpoint, {
      headers: { authorization: `WebID ${encodeURIComponent(owner)}` },
    });
    expect(response.status).toBe(200);
    const parser = new Parser();
    const store = new Store(parser.parse(await response.text()));
    expect(store.countQuads(null, ODRL.terms.action, 'http://www.w3.org/ns/odrl/2/read', null)).toBe(1);
    expect(store.countQuads(null, ODRL.terms.target, target, null)).toBe(1);
    expect(store.countQuads(null, ODRL.terms.assignee, requester, null)).toBe(1);
    expect(store.countQuads(null, ODRL.terms.assigner, owner, null)).toBe(1);
  });

  it('can deny requests.', async(): Promise<void> => {
    let response = await fetch(accessRequestEndpoint, {
      method: 'POST',
      headers: {
        authorization: `WebID ${encodeURIComponent(requester)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ resource_id: target, resource_scopes: [ 'http://www.w3.org/ns/odrl/2/write' ]}),
    });
    requestLocation = response.headers.get('location')!;
    expect(requestLocation.length).toBeGreaterThan(0);
    await expect(response.status).toBe(201);

    response = await fetch(requestLocation, {
      method: 'PATCH',
      headers: { authorization: `WebID ${encodeURIComponent(owner)}`  },
      body: JSON.stringify({ status: 'denied' }),
    });
    expect(response.status).toBe(204);

    // Can not be changed
    response = await fetch(requestLocation, {
      method: 'PATCH',
      headers: { authorization: `WebID ${encodeURIComponent(owner)}` },
      body: JSON.stringify({ status: 'accepted' }),
    });
    expect(response.status).toBe(409);

    // Did not generate a policy
    response = await fetch(policyEndpoint, {
      headers: { authorization: `WebID ${encodeURIComponent(owner)}` },
    });
    expect(response.status).toBe(200);
    const parser = new Parser();
    const store = new Store(parser.parse(await response.text()));
    expect(store.countQuads(null, ODRL.terms.action, 'http://www.w3.org/ns/odrl/2/write', null)).toBe(0);
  });

  it('can add constraints to requests.', async(): Promise<void> => {
    const purpose = 'http://example.com/purpose';
    let response = await fetch(accessRequestEndpoint, {
      method: 'POST',
      headers: {
        authorization: `WebID ${encodeURIComponent(requester)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        resource_id: target,
        resource_scopes: [ 'http://www.w3.org/ns/odrl/2/create' ],
        constraints: [[ 'http://www.w3.org/ns/odrl/2/purpose', 'http://www.w3.org/ns/odrl/2/eq', purpose ]],
      }),
    });

    expect(response.status).toBe(201);
    requestLocation = response.headers.get('location')!;
    expect(requestLocation.length).toBeGreaterThan(0);

    // Can see the constraints in the request
    response = await fetch(requestLocation, { headers: { authorization: `WebID ${encodeURIComponent(owner)}` }});
    const requestQuads = new Store(new Parser().parse(await response.text()));
    expect(requestQuads.countQuads(null, ODRL.terms.leftOperand, ODRL.terms.purpose, null)).toBe(1);

    response = await fetch(requestLocation, {
      method: 'PATCH',
      headers: { authorization: `WebID ${encodeURIComponent(owner)}`  },
      body: JSON.stringify({ status: 'accepted' }),
    });
    expect(response.status).toBe(204);

    // Generated a policy with constraints
    response = await fetch(policyEndpoint, {
      headers: { authorization: `WebID ${encodeURIComponent(owner)}` },
    });
    expect(response.status).toBe(200);
    const policyQuads = new Store(new Parser().parse(await response.text()));
    expect(policyQuads.countQuads(null, ODRL.terms.action, 'http://www.w3.org/ns/odrl/2/create', null)).toBe(1);
    expect(policyQuads.countQuads(null, ODRL.terms.leftOperand, ODRL.terms.purpose, null)).toBe(1);
  });
});
