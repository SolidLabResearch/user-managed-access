import { AlgJwk, App, CachedJwkGenerator, MemoryMapStorage } from '@solid/community-server';
import { setGlobalLoggerFactory, WinstonLoggerFactory } from 'global-logger-factory';
import { importJWK, SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import { createServer, Server } from 'node:http';
import path from 'node:path';
import { getDefaultCssVariables, getPorts, instantiateFromConfig } from '../util/ServerUtil';
import { findTokenEndpoint, noTokenFetch } from '../util/UmaUtil';

const [ cssPort, umaPort ] = getPorts('Policies');
const idpPort = umaPort + 100;

describe('A server supporting OIDC tokens', (): void => {
  const webId = 'http://example.com/profile/card#me';
  let privateKey: AlgJwk;
  let umaApp: App;
  let cssApp: App;
  let idp: Server;
  const idpUrl = `http://localhost:${idpPort}/`;
  const policyEndpoint = `http://localhost:${umaPort}/uma/policies`;
  const oidcFormat = 'http://openid.net/specs/openid-connect-core-1_0.html#IDToken';

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

    const generator = new CachedJwkGenerator('ES256', 'jwks', new MemoryMapStorage());
    privateKey = { ...await generator.getPrivateKey(), kid: 'kid' };
    const publicKey = { ...await generator.getPublicKey(), kid: 'kid' }
    idp = createServer((req, res) => {
      console.log(req.url);
      if (req.url!.endsWith('/card')) {
        res.writeHead(200, { 'content-type': 'text/turtle' });
        res.end(`
          @prefix foaf: <http://xmlns.com/foaf/0.1/>.
          @prefix solid: <http://www.w3.org/ns/solid/terms#>.
          
          <>
              a foaf:PersonalProfileDocument;
              foaf:primaryTopic <#me>.
          
          <#me>
              solid:oidcIssuer <${idpUrl}>;
              a foaf:Person.`);
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      if (req.url!.endsWith('/.well-known/openid-configuration')) {
        res.end(JSON.stringify({ jwks_uri: idpUrl }));
        return;
      }
      // Exposing private keys is fine right
      res.end(JSON.stringify({ keys: [ publicKey ] }));
    });
    idp.listen(idpPort);

    await Promise.all([umaApp.start(), cssApp.start()]);
  });

  describe('accessing a resource using a standard OIDC token.', (): void => {
    const resource = `http://localhost:${cssPort}/alice/standard`;
    const sub = '123456';
    const policy = `
      @prefix ex: <http://example.org/>.
      @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
      @prefix dct: <http://purl.org/dc/terms/>.
      ex:policyStandard a odrl:Set;
          odrl:uid ex:policyStandard ;
          odrl:permission ex:permissionStandard .
          
      ex:permissionStandard a odrl:Permission ;
        odrl:assignee <${sub}> ;
        odrl:assigner <${webId}>;
        odrl:action odrl:read , odrl:create , odrl:modify ;
        odrl:target <http://localhost:${cssPort}/alice/> .`;

    it('can set up the policy.', async(): Promise<void> => {
      const response = await fetch(policyEndpoint, {
        method: 'POST',
        headers: { authorization: webId, 'content-type': 'text/turtle' },
        body: policy,
      });
      expect(response.status).toBe(201);
    });

    it('can get an access token.', async(): Promise<void> => {
      const { as_uri, ticket } = await noTokenFetch(resource, {
        method: 'PUT',
        headers: { 'content-type': 'text/plain' },
        body: 'hello',
      });
      const endpoint = await findTokenEndpoint(as_uri);

      const jwk = await importJWK(privateKey, privateKey.alg);
      const jwt = await new SignJWT({})
        .setSubject(sub)
        .setProtectedHeader({ alg: privateKey.alg, kid: privateKey.kid })
        .setIssuedAt()
        .setIssuer(idpUrl)
        .setAudience(`http://localhost:${umaPort}/uma`)
        .setJti(randomUUID())
        .sign(jwk);

      const content: Record<string, string> = {
        grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
        ticket: ticket,
        claim_token: jwt,
        claim_token_format: oidcFormat,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(content),
      });
      expect(response.status).toBe(200);
    });
  });


  describe('accessing a resource using a Solid OIDC token.', (): void => {
    const resource = `http://localhost:${cssPort}/alice/standard`;
    // Using dummy server so we can spoof WebID
    const alice =  idpUrl + 'alice/profile/card#me';
    const policy = `
      @prefix ex: <http://example.org/>.
      @prefix odrl: <http://www.w3.org/ns/odrl/2/> .
      @prefix dct: <http://purl.org/dc/terms/>.
      ex:policySolid a odrl:Set;
          odrl:uid ex:policySolid ;
          odrl:permission ex:permissionSolid .
          
      ex:permissionSolid a odrl:Permission ;
        odrl:assignee <${alice}> ;
        odrl:assigner <${webId}>;
        odrl:action odrl:read , odrl:create , odrl:modify ;
        odrl:target <http://localhost:${cssPort}/alice/> .`;

    it('can set up the policy.', async(): Promise<void> => {
      const response = await fetch(policyEndpoint, {
        method: 'POST',
        headers: { authorization: webId, 'content-type': 'text/turtle' },
        body: policy,
      });
      expect(response.status).toBe(201);
    });

    // TODO: might want a test with an actual token from the RS IDP, but would require more steps and dependencies
    it('can get an access token.', async(): Promise<void> => {
      const { as_uri, ticket } = await noTokenFetch(resource, {
        method: 'PUT',
        headers: { 'content-type': 'text/plain' },
        body: 'hello',
      });
      const endpoint = await findTokenEndpoint(as_uri);

      const jwk = await importJWK(privateKey, privateKey.alg);
      const jwt = await new SignJWT({ webid: alice })
        .setSubject(alice)
        .setProtectedHeader({ alg: privateKey.alg, kid: privateKey.kid })
        .setIssuedAt()
        .setIssuer(idpUrl)
        .setAudience([ 'solid', `http://localhost:${umaPort}/uma` ])
        .setJti(randomUUID())
        .setExpirationTime(Date.now() + 5000)
        .sign(jwk);

      const content: Record<string, string> = {
        grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
        ticket: ticket,
        claim_token: jwt,
        claim_token_format: oidcFormat,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(content),
      });
      expect(response.status).toBe(200);
    });
  });
});
