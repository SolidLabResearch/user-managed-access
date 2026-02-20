import { App, joinUrl } from '@solid/community-server';
import { setGlobalLoggerFactory, WinstonLoggerFactory } from 'global-logger-factory';
import path from 'node:path';
import { getDefaultCssVariables, getPorts, instantiateFromConfig } from '../util/ServerUtil';
import { generateCredentials, umaFetch } from '../util/UmaUtil';

const [ cssPort, umaPort ] = getPorts('Collections');

describe('A server with collections', (): void => {
  const owner = `http://localhost:${cssPort}/alice/profile/card#me`;
  const user = `http://example.com/bob`;
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

  it('can create a policy targeting an asset collection.', async(): Promise<void> => {
    // TODO: hardcoded collection identifier due to lack of collection API
    const policy = `
      @prefix ex:     <http://example.org/> .
      @prefix ldp:    <http://www.w3.org/ns/ldp#>.
      @prefix odrl:   <http://www.w3.org/ns/odrl/2/>.
      @prefix odrl_p: <https://w3id.org/force/odrl3proposal#>.
      
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

    response = await fetch(joinUrl(url, encodeURIComponent('http://example.org/policy')), {
      headers: { authorization: `WebID ${encodeURIComponent(owner)}` },
    });
    console.log(await response.text());
  });

  it('can access a resource in the asset collection.', async(): Promise<void> => {
    const response = await umaFetch(`http://localhost:${cssPort}/alice/README`, {}, user);
    expect(response.status).toBe(200);
  });
});
