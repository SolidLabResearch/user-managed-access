import { App } from '@solid/community-server';
import { setGlobalLoggerFactory, WinstonLoggerFactory } from 'global-logger-factory';
import { createServer, Server } from 'node:http';
import path from 'node:path';
import { getPorts, instantiateFromConfig } from '../util/ServerUtil';
import { getToken, umaFetch } from '../util/UmaUtil';

const [ rsPort, umaPort ] = getPorts('Partial');

interface UmaConfig {
  issuer: string;
  permission_endpoint: string;
  resource_registration_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
}

describe('A server with partial results enabled', (): void => {
  const owner = 'http://example.com/alice#me';
  const user = `http://example.com/bob`;
  const resource = `http://localhost:${rsPort}/alice/data`;
  const readScope = 'http://www.w3.org/ns/odrl/2/read';
  const writeScope = 'http://www.w3.org/ns/odrl/2/write';
  let umaApp: App;
  let rsServer: Server;
  let umaConfig: UmaConfig;
  let pat: string;

  beforeAll(async(): Promise<void> => {
    setGlobalLoggerFactory(new WinstonLoggerFactory('off'));

    umaApp = await instantiateFromConfig(
      'urn:uma:default:App',
      [
        path.join(__dirname, '../../packages/uma/config/default.json'),
        path.join(__dirname, '../../packages/uma/config/enable-partial.json'),
      ],
      {
        'urn:uma:variables:port': umaPort,
        'urn:uma:variables:baseUrl': `http://localhost:${umaPort}/uma`,
        'urn:uma:variables:backupFilePath': '',
      }
    );
    await umaApp.start();

    const configResponse = await fetch(`http://localhost:${umaPort}/uma/.well-known/uma2-configuration`);
    expect(configResponse.status).toBe(200);
    umaConfig = await configResponse.json() as UmaConfig;

    const registrationResponse = await fetch(umaConfig.registration_endpoint, {
      method: 'POST',
      headers: {
        authorization: `WebID ${encodeURIComponent(owner)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ client_uri: `http://localhost:${rsPort}/` }),
    });
    expect(registrationResponse.status).toBe(201);
    const { client_id, client_secret } = await registrationResponse.json() as {
      client_id: string,
      client_secret: string,
    };

    const authString = `${encodeURIComponent(client_id)}:${encodeURIComponent(client_secret)}`;
    const credentials = `Basic ${Buffer.from(authString).toString('base64')}`;
    const patResponse = await fetch(umaConfig.token_endpoint, {
      method: 'POST',
      headers: {
        authorization: credentials,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=uma_protection',
    });
    expect(patResponse.status).toBe(201);
    const patJson = await patResponse.json() as { access_token: string, token_type: string };
    pat = `${patJson.token_type} ${patJson.access_token}`;

    const registrationBody = {
      name: resource,
      resource_scopes: [ readScope, writeScope ],
    };
    const resourceRegistrationResponse = await fetch(umaConfig.resource_registration_endpoint, {
      method: 'POST',
      headers: {
        Authorization: pat,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(registrationBody),
    });
    expect(resourceRegistrationResponse.status).toBe(201);

    rsServer = createServer((request, response): void => {
      void (async(): Promise<void> => {
        if (!request.url || !request.url.startsWith('/alice/data')) {
          response.statusCode = 404;
          response.end();
          return;
        }

        const auth = request.headers.authorization;
        if (hasScope(auth, resource, readScope)) {
          response.statusCode = 200;
          response.end('protected data');
          return;
        }

        const permissionResponse = await fetch(umaConfig.permission_endpoint, {
          method: 'POST',
          headers: {
            Authorization: pat,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify([
            {
              resource_id: resource,
              resource_scopes: [ readScope ],
            }
          ]),
        });

        if (permissionResponse.status !== 201) {
          response.statusCode = 500;
          response.end(await permissionResponse.text());
          return;
        }

        const { ticket } = await permissionResponse.json() as { ticket: string };
        response.statusCode = 401;
        response.setHeader('WWW-Authenticate', `UMA realm="solid", as_uri="${umaConfig.issuer}", ticket="${ticket}"`);
        response.end();
      })().catch((error: unknown): void => {
        response.statusCode = 500;
        response.end(String(error));
      });
    });

    await new Promise<void>((resolve): void => {
      rsServer.listen(rsPort, resolve);
    });
  });

  afterAll(async(): Promise<void> => {
    const shutdown: Promise<unknown>[] = [];
    if (umaApp) {
      shutdown.push(umaApp.stop());
    }
    if (rsServer) {
      shutdown.push(new Promise<void>((resolve, reject): void => {
        rsServer.close((error): void => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }));
    }
    await Promise.all(shutdown);
  });

  it('can create a policy for the protected resource.', async(): Promise<void> => {
    const policy = `
      @prefix ex:     <http://example.org/> .
      @prefix odrl:   <http://www.w3.org/ns/odrl/2/> .
      
      ex:policy a odrl:Agreement ;
        odrl:uid ex:policy ;
        odrl:permission ex:ownerPermission, ex:userPermission .
      
      ex:ownerPermission a odrl:Permission ;
        odrl:assignee <${owner}> ;
        odrl:assigner <${owner}> ;
        odrl:action odrl:create, odrl:modify ;
        odrl:target <http://localhost:${rsPort}/alice/> ,
                    <${resource}> .

      ex:userPermission a odrl:Permission ;
        odrl:assignee <${user}> ;
        odrl:assigner <${owner}> ;
        odrl:action odrl:read ;
        odrl:target <${resource}> .`;

    const url = `http://localhost:${umaPort}/uma/policies`;
    let response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `WebID ${encodeURIComponent(owner)}`, 'content-type': 'text/turtle' },
      body: policy,
    });
    expect(response.status).toBe(201);

    response = await umaFetch(resource, {}, user);
    expect(response.status).toBe(200);
  });

  it('returns partial=true when not all requested scopes are granted.', async(): Promise<void> => {
    const permissionResponse = await fetch(umaConfig.permission_endpoint, {
      method: 'POST',
      headers: {
        Authorization: pat,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify([
        {
          resource_id: resource,
          resource_scopes: [ readScope, writeScope ],
        }
      ]),
    });
    expect(permissionResponse.status).toBe(201);
    const { ticket } = await permissionResponse.json() as { ticket: string };

    const token = await getToken(ticket, umaConfig.token_endpoint, user);

    // Verify partial flag is present
    expect((token as unknown as { partial?: boolean }).partial).toBe(true);

    // Verify the token contains the allowed scope
    const jwtPayload = JSON.parse(Buffer.from(token.access_token.split('.')[1], 'base64').toString());
    expect(Array.isArray(jwtPayload.permissions)).toBe(true);
    expect(jwtPayload.permissions).toContainEqual({
      resource_id: resource,
      resource_scopes: [ readScope ]
    });
  });

  it('can access a protected resource with partial results.', async(): Promise<void> => {
    const response = await umaFetch(resource, {}, user);
    expect(response.status).toBe(200);
  });
});

function hasScope(authHeader: string | undefined, resource: string, scope: string): boolean {
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  try {
    const token = authHeader.slice('Bearer '.length);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()) as {
      permissions?: { resource_id: string, resource_scopes: string[] }[]
    };
    return Array.isArray(payload.permissions)
      && payload.permissions.some((permission): boolean =>
        permission.resource_id === resource && permission.resource_scopes.includes(scope)
      );
  } catch {
    return false;
  }
}
