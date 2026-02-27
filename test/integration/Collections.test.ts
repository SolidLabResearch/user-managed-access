import 'jest-rdf';
import { App, RDF } from '@solid/community-server';
import { DC, ODRL, ODRL_P } from '@solidlab/uma';
import { setGlobalLoggerFactory, WinstonLoggerFactory } from 'global-logger-factory';
import { Parser, Quad_Subject, Store } from 'n3';
import path from 'node:path';
import { getDefaultCssVariables, getPorts, instantiateFromConfig } from '../util/ServerUtil';
import { generateCredentials, umaFetch } from '../util/UmaUtil';

const [ cssPort, umaPort ] = getPorts('Collections');

describe('A server with collections', (): void => {
  const owner = `http://localhost:${cssPort}/alice/profile/card#me`;
  const user = `http://example.com/bob`;
  const user2 = `http://example.com/carol`;
  let assetCollection: string;
  let partyCollection: string;
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
    );

    cssApp = await instantiateFromConfig(
      'urn:solid-server:default:App',
      path.join(__dirname, '../../packages/css/config/default.json'),
      {
        ...getDefaultCssVariables(cssPort),
        'urn:solid-server:default:variable:seedConfig':  path.join(__dirname, '../../packages/css/config/seed.json'),
      },
    );

    await Promise.all([ umaApp.start(), cssApp.start() ]);
  });

  afterAll(async(): Promise<void> => {
    await Promise.all([ umaApp.stop(), cssApp.stop() ]);
  });

  it('can register client credentials for the user/RS combination.', async(): Promise<void> => {
    await generateCredentials({
      webId: owner,
      authorizationServer: `http://localhost:${umaPort}/uma`,
      resourceServer: `http://localhost:${cssPort}/`,
      email: 'alice@example.org',
      password: 'abc123'
    });
  });

  it('can create a policy targeting an automatically generated asset collection.', async(): Promise<void> => {
    // TODO: using the hardcoded identifier here
    const policy = `
      @prefix ex:     <http://example.org/> .
      @prefix ldp:    <http://www.w3.org/ns/ldp#>.
      @prefix odrl:   <http://www.w3.org/ns/odrl/2/>.
      
      ex:policy a odrl:Set ;
        odrl:uid ex:policy ;
        odrl:permission ex:permission .
      
      ex:permission a odrl:Permission ;
        odrl:assignee <${user}> ;
        odrl:assigner <${owner}> ;
        odrl:action odrl:read ;
        odrl:target <collection:http://localhost:${cssPort}/alice/:http://www.w3.org/ns/ldp#contains> .`

    const url = `http://localhost:${umaPort}/uma/policies`;
    let response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `WebID ${encodeURIComponent(owner)}`, 'content-type': 'text/turtle' },
      body: policy,
    });
    expect(response.status).toBe(201);
  });

  it('can access a resource in the asset collection.', async(): Promise<void> => {
    const response = await umaFetch(`http://localhost:${cssPort}/alice/README`, {}, user);
    expect(response.status).toBe(200);
  });

  it('can create a custom asset collection.', async(): Promise<void> => {
    const response = await fetch(`http://localhost:${umaPort}/uma/collections`, {
      method: 'POST',
      headers: { authorization: `WebID ${encodeURIComponent(owner)}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        description: 'My assets',
        type: 'asset',
        owners: [ owner ],
        parts: [ `http://localhost:${cssPort}/alice/`, `http://localhost:${cssPort}/alice/README` ],
      }),
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('location')).toBeDefined();
    assetCollection = response.headers.get('location')!;
  });

  it('can only create a custom asset collection over owned resources.', async(): Promise<void> => {
    const response = await fetch(`http://localhost:${umaPort}/uma/collections`, {
      method: 'POST',
      headers: { authorization: `WebID ${encodeURIComponent(user)}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        description: 'My assets',
        type: 'asset',
        owners: [ owner ],
        parts: [ `http://localhost:${cssPort}/alice/`, `http://localhost:${cssPort}/alice/README` ],
      }),
    });
    expect(response.status).toBe(403);
  });

  it('can create a custom party collection.', async(): Promise<void> => {
    const response = await fetch(`http://localhost:${umaPort}/uma/collections`, {
      method: 'POST',
      headers: { authorization: `WebID ${encodeURIComponent(owner)}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        description: 'My party',
        type: 'party',
        owners: [ owner ],
        parts: [ owner, user ],
      }),
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('location')).toBeDefined();
    partyCollection = response.headers.get('location')!;
  });

  it('can read owned collections.', async(): Promise<void> => {
    const response = await fetch(`http://localhost:${umaPort}/uma/collections`, {
      headers: { authorization: `WebID ${encodeURIComponent(owner)}` },
    });
    expect(response.status).toBe(200);
    const expectedTurtle = `
      @prefix dc: <http://purl.org/dc/terms/>.
      @prefix odrl: <http://www.w3.org/ns/odrl/2/>.
      <${assetCollection}> a odrl:AssetCollection ;
        dc:description "My assets" ;
        dc:creator <${owner}> .
      <http://localhost:${cssPort}/alice/> odrl:partOf <${assetCollection}> .
      <http://localhost:${cssPort}/alice/README> odrl:partOf <${assetCollection}> .
      <${partyCollection}> a odrl:PartyCollection ;
        dc:description "My party" ;
        dc:creator <${owner}> .
      <${owner}> odrl:partOf <${partyCollection}> .
      <${user}> odrl:partOf <${partyCollection}> .
    `;
    const responseStore = new Store(new Parser().parse(await response.text()));
    for (const quad of new Parser().parse(expectedTurtle)) {
      expect(responseStore.has(quad)).toBe(true);
    }

    // Check auto-generated collections
    const expectedContainers = [
      `http://localhost:${cssPort}/alice/`,
      `http://localhost:${cssPort}/alice/profile/`,
    ];
    const subjectMap: Record<string, Quad_Subject> = {};
    for (const resource of expectedContainers) {
      const subjects = responseStore.getSubjects(ODRL.terms.source, resource, null);
      expect(subjects).toHaveLength(1);
      subjectMap[resource] = subjects[0];
      expect(responseStore.countQuads(subjects[0], RDF.terms.type, ODRL.terms.AssetCollection, null)).toBe(1);
      expect(responseStore.countQuads(subjects[0], ODRL_P.terms.relation, 'http://www.w3.org/ns/ldp#contains', null)).toBe(1);
    }
    expect(responseStore.countQuads(`http://localhost:${cssPort}/alice/README`,
      ODRL.terms.partOf, subjectMap[`http://localhost:${cssPort}/alice/`], null)).toBe(1);
    expect(responseStore.countQuads(`http://localhost:${cssPort}/alice/profile/`,
      ODRL.terms.partOf, subjectMap[`http://localhost:${cssPort}/alice/`], null)).toBe(1);
    expect(responseStore.countQuads(`http://localhost:${cssPort}/alice/profile/card`,
      ODRL.terms.partOf, subjectMap[`http://localhost:${cssPort}/alice/profile/`], null)).toBe(1);
  });

  it('can read single collections.', async(): Promise<void> => {
    const response = await fetch(partyCollection, {
      headers: { authorization: `WebID ${encodeURIComponent(owner)}` },
    });
    expect(response.status).toBe(200);
    const expectedTurtle = `
      @prefix dc: <http://purl.org/dc/terms/>.
      @prefix odrl: <http://www.w3.org/ns/odrl/2/>.
      <${partyCollection}> a odrl:PartyCollection ;
        dc:description "My party" ;
        dc:creator <${owner}> .
      <${owner}> odrl:partOf <${partyCollection}> .
      <${user}> odrl:partOf <${partyCollection}> .
    `;
    expect(new Parser().parse(await response.text())).toBeRdfIsomorphic(new Parser().parse(expectedTurtle));
  });

  it('can replace collections.', async(): Promise<void> => {
    let response = await fetch(partyCollection, {
      method: 'PUT',
      headers: { authorization: `WebID ${encodeURIComponent(owner)}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        description: 'My updated party',
        type: 'party',
        owners: [ owner, user ],
        parts: [ user, user2 ],
      }),
    });
    expect(response.status).toBe(204);


    response = await fetch(`http://localhost:${umaPort}/uma/collections`, {
      headers: { authorization: `WebID ${encodeURIComponent(owner)}` },
    });
    expect(response.status).toBe(200);
    const expectedTurtle = `
      @prefix dc: <http://purl.org/dc/terms/>.
      @prefix odrl: <http://www.w3.org/ns/odrl/2/>.
      <${partyCollection}> a odrl:PartyCollection ;
        dc:description "My updated party" ;
        dc:creator <${owner}> , <${user}> .
      <${user}> odrl:partOf <${partyCollection}> .
      <${user2}> odrl:partOf <${partyCollection}> .
    `;
    const responseStore = new Store(new Parser().parse(await response.text()));
    for (const quad of new Parser().parse(expectedTurtle)) {
      expect(responseStore.has(quad)).toBe(true);
    }
    expect(responseStore.countQuads(partyCollection, DC.terms.description, 'My party', null)).toBe(0);
    expect(responseStore.countQuads(owner, ODRL.terms.partOf, partyCollection, null)).toBe(0);
  });

  it('can access resources using these collections.', async(): Promise<void> => {
    const policy = `
      @prefix ex:     <http://example.org/> .
      @prefix ldp:    <http://www.w3.org/ns/ldp#>.
      @prefix odrl:   <http://www.w3.org/ns/odrl/2/>.
      
      ex:policy2 a odrl:Set ;
        odrl:uid ex:policy2 ;
        odrl:permission ex:permission2 .
      
      ex:permission2 a odrl:Permission ;
        odrl:assignee <${partyCollection}> ;
        odrl:assigner <${owner}> ;
        odrl:action odrl:read ;
        odrl:target <${assetCollection}> .`

    const url = `http://localhost:${umaPort}/uma/policies`;
    let response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `WebID ${encodeURIComponent(owner)}`, 'content-type': 'text/turtle' },
      body: policy,
    });
    expect(response.status).toBe(201);

    response = await umaFetch(`http://localhost:${cssPort}/alice/README`, {}, user2);
    expect(response.status).toBe(200);
  });
});
