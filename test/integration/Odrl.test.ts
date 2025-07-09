import { App, setGlobalLoggerFactory, WinstonLoggerFactory } from '@solid/community-server';
import * as path from 'node:path';
import { getDefaultCssVariables, instantiateFromConfig } from '../util/ServerUtil';

const cssPort = 3002;
const umaPort = 4002;

describe('An ODRL server setup', (): void => {
  let umaApp: App;
  let cssApp: App;

  const resource = `http://localhost:${cssPort}/alice/other/resource.txt`;

  beforeAll(async(): Promise<void> => {
    setGlobalLoggerFactory(new WinstonLoggerFactory('off'));

    umaApp = await instantiateFromConfig(
      'urn:uma:default:App',
      path.join(__dirname, '../../packages/uma/config/odrl.json'),
      {
        'urn:uma:variables:port': umaPort,
        'urn:uma:variables:baseUrl': `http://localhost:${umaPort}/uma`,
        'urn:uma:variables:policyBaseIRI': `http://localhost:${cssPort}/`,
        'urn:uma:variables:policyDir': path.join(__dirname, '../../packages/uma/config/rules/odrl'),
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

  describe('creating a resource', (): void => {
    let wwwAuthenticateHeader: string;
    let ticket: string;
    let tokenEndpoint: string;
    let jsonResponse: { access_token: string, token_type: string };

    it('RS: sends a WWW-Authenticate response when access is private.', async(): Promise<void> => {
      const noTokenResponse = await fetch(resource, {
        method: "PUT",
        body: 'some text' ,
      });

      expect(noTokenResponse.status).toBe(401);
      wwwAuthenticateHeader = noTokenResponse.headers.get("WWW-Authenticate");
      expect(typeof wwwAuthenticateHeader).toBe('string');
    });

    it('AS: returns the token endpoint from the configuration.', async(): Promise<void> => {
      const parsedHeader = Object.fromEntries(
        wwwAuthenticateHeader
          .replace(/^UMA /,'')
          .split(', ')
          .map(param => param.split('=').map(s => s.replace(/"/g,'')))
      );
      expect(typeof parsedHeader.as_uri).toBe('string');
      expect(typeof parsedHeader.ticket).toBe('string');
      ticket = parsedHeader.ticket;

      const configurationUrl = parsedHeader.as_uri + '/.well-known/uma2-configuration';
      const response = await fetch(configurationUrl);
      expect(response.status).toBe(200);
      const configuration = await response.json();
      expect(typeof configuration.token_endpoint).toBe('string');
      tokenEndpoint = configuration.token_endpoint;
    });

    it('AS: responds with a token when receiving the ticket.', async(): Promise<void> => {
      const claim_token = 'https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me';

      const content = {
        grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
        ticket,
        claim_token: encodeURIComponent(claim_token),
        claim_token_format: 'urn:solidlab:uma:claims:formats:webid',
      };

      const asRequestResponse = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(content),
      });

      expect(asRequestResponse.status).toBe(200);
      expect(asRequestResponse.headers.get('content-type')).toBe('application/json');
      jsonResponse = await asRequestResponse.json();
      expect(typeof jsonResponse.access_token).toBe('string');
      expect(jsonResponse.token_type).toBe('Bearer');
      const token = JSON.parse(Buffer.from(jsonResponse.access_token.split('.')[1], 'base64').toString());
      expect(Array.isArray(token.permissions)).toBe(true);
      expect(token.permissions).toHaveLength(2);
      expect(token.permissions).toContainEqual({
        resource_id: resource,
        resource_scopes: [ 'urn:example:css:modes:append', 'urn:example:css:modes:create' ]
      });
      expect(token.permissions).toContainEqual({
          resource_id: `http://localhost:${cssPort}/alice/other/`,
          resource_scopes: [ 'urn:example:css:modes:create' ]
        }
      );
    });

    it('RS: provides access when receiving a valid token.', async(): Promise<void> => {
      const response = await fetch(resource, {
        method: "PUT",
        headers: { 'Authorization': `${jsonResponse.token_type} ${jsonResponse.access_token}` },
        body: 'Some text ...' ,
      });

      expect(response.status).toBe(201);
    });
  });

  describe('reading a resource', (): void => {
    let wwwAuthenticateHeader: string;
    let ticket: string;
    let tokenEndpoint: string;
    let jsonResponse: { access_token: string, token_type: string };

    it('RS: sends a WWW-Authenticate response when access is private.', async(): Promise<void> => {
      const noTokenResponse = await fetch(resource);

      expect(noTokenResponse.status).toBe(401);
      wwwAuthenticateHeader = noTokenResponse.headers.get("WWW-Authenticate");
      expect(typeof wwwAuthenticateHeader).toBe('string');
    });

    it('AS: returns the token endpoint from the configuration.', async(): Promise<void> => {
      const parsedHeader = Object.fromEntries(
        wwwAuthenticateHeader
          .replace(/^UMA /,'')
          .split(', ')
          .map(param => param.split('=').map(s => s.replace(/"/g,'')))
      );
      expect(typeof parsedHeader.as_uri).toBe('string');
      expect(typeof parsedHeader.ticket).toBe('string');
      ticket = parsedHeader.ticket;

      const configurationUrl = parsedHeader.as_uri + '/.well-known/uma2-configuration';
      const response = await fetch(configurationUrl);
      expect(response.status).toBe(200);
      const configuration = await response.json();
      expect(typeof configuration.token_endpoint).toBe('string');
      tokenEndpoint = configuration.token_endpoint;
    });

    it('AS: responds with a token when receiving the ticket.', async(): Promise<void> => {
      const claim_token = 'https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me';

      const content = {
        grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
        ticket,
        claim_token: encodeURIComponent(claim_token),
        claim_token_format: 'urn:solidlab:uma:claims:formats:webid',
      };

      const asRequestResponse = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(content),
      });

      expect(asRequestResponse.status).toBe(200);
      expect(asRequestResponse.headers.get('content-type')).toBe('application/json');
      jsonResponse = await asRequestResponse.json();
      expect(typeof jsonResponse.access_token).toBe('string');
      expect(jsonResponse.token_type).toBe('Bearer');
      const token = JSON.parse(Buffer.from(jsonResponse.access_token.split('.')[1], 'base64').toString());
      expect(Array.isArray(token.permissions)).toBe(true);
      expect(token.permissions).toHaveLength(1);
      expect(token.permissions).toContainEqual({
        resource_id: resource,
        resource_scopes: [ 'urn:example:css:modes:read' ],
      });
    });

    it('RS: provides access when receiving a valid token.', async(): Promise<void> => {
      const response = await fetch(resource, {
        headers: { 'Authorization': `${jsonResponse.token_type} ${jsonResponse.access_token}` },
      });

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe('Some text ...');
    });
  });
});
