import { App, InternalServerError, joinUrl } from '@solid/community-server';
import type { ResourceDescription } from '@solidlab/uma';
import { RequiredClaim } from '@solidlab/uma';
import { setGlobalLoggerFactory, WinstonLoggerFactory } from 'global-logger-factory';
import path from 'node:path';
import { getDefaultCssVariables, getPorts, instantiateFromConfig } from '../util/ServerUtil';
import { generateCredentials, getToken, noTokenFetch, umaFetch } from '../util/UmaUtil';

const [ aggregatorPort, aggUmaPort ] = getPorts('Aggregation');
const [ srcCssPort, srcUmaPort ] = getPorts('AggregationSource');

interface UmaConfig {
  jwks_uri: string;
  issuer: string;
  permission_endpoint: string;
  introspection_endpoint: string;
  resource_registration_endpoint: string;
  token_endpoint: string,
  registration_endpoint: string,
}

function getUmaApp(port: number): Promise<App> {
  return instantiateFromConfig(
    'urn:uma:default:App',
    path.join(__dirname, '../../packages/uma/config/default.json'),
    {
      'urn:uma:variables:port': port,
      'urn:uma:variables:baseUrl': `http://localhost:${port}/uma`,
      'urn:uma:variables:backupFilePath': '',
    }
  );
}

function getCssApp(port: number): Promise<App> {
  return instantiateFromConfig(
    'urn:solid-server:default:App',
    path.join(__dirname, '../../packages/css/config/default.json'),
    {
      ...getDefaultCssVariables(port),
      'urn:solid-server:default:variable:seedConfig':  path.join(__dirname, '../../packages/css/config/seed.json'),
    },
  );
}

describe('An aggregation setup', (): void => {
  const user = `http://localhost:${srcCssPort}/alice/profile/card#me`;
  const aggregator = `http://localhost:${aggregatorPort}/aggregator/profile/card#me`;
  const container = `http://localhost:${srcCssPort}/alice/`;
  const target = `http://localhost:${srcCssPort}/alice/test`;
  let aggConfig: UmaConfig;
  let srcConfig: UmaConfig;
  // PAT used to access aggregator AS
  let pat: string;
  // ID of aggregated resource
  let aggregatedResourceId: string;
  // Derivation ID of source resource
  let derivationId: string;
  // Ticket that needs to be passed in between tests
  let previousTicket: string;
  // Token that gives derivation-read access
  let accessToken: string;
  let aggUmaApp: App;
  let srcUmaApp: App;
  let srcCssApp: App;

  beforeAll(async(): Promise<void> => {
    setGlobalLoggerFactory(new WinstonLoggerFactory('off'));

    aggUmaApp = await getUmaApp(aggUmaPort);

    srcUmaApp = await getUmaApp(srcUmaPort);
    srcCssApp = await getCssApp(srcCssPort);

    await Promise.all([ aggUmaApp.start(), srcUmaApp.start(), srcCssApp.start() ]);
  });

  afterAll(async(): Promise<void> => {
    await Promise.all([ aggUmaApp.stop(), srcUmaApp.stop(), srcCssApp.stop() ]);
  });

  it('can register client credentials for the user/RS combination.', async(): Promise<void> => {
    await generateCredentials({
      webId: user,
      authorizationServer: `http://localhost:${srcUmaPort}/uma`,
      resourceServer: `http://localhost:${srcCssPort}/`,
      email: 'alice@example.org',
      password: 'abc123'
    });
  });

  it('can register client credentials for the aggregator.', async(): Promise<void> => {
    const configurationUrl = `http://localhost:${aggUmaPort}/uma/.well-known/uma2-configuration`;
    const configResponse = await fetch(configurationUrl);
    expect(configResponse.status).toBe(200);
    aggConfig = await configResponse.json() as UmaConfig;
    expect(aggConfig.registration_endpoint).toBeDefined();

    let response = await fetch(aggConfig.registration_endpoint, {
      method: 'POST',
      headers: {
        authorization: `WebID ${encodeURIComponent(aggregator)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ client_uri: `http://localhost:${aggregatorPort}/` }),
    });
    expect(response.status).toBe(201);
    const { client_id, client_secret } = await response.json() as { client_id: string, client_secret: string };

    // Use credentials to generate PAT
    const authString = `${encodeURIComponent(client_id)}:${encodeURIComponent(client_secret)}`;
    const credentials = `Basic ${Buffer.from(authString).toString('base64')}`;
    response = await fetch(aggConfig.token_endpoint, {
      method: 'POST',
      headers: {
        authorization: credentials,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=uma_protection',
    });
    if (response.status !== 201) {
      throw new InternalServerError(`Unable to generate PAT: ${response.status} - ${await response.text()}`);
    }

    const json = await response.json()  as { access_token: string, token_type: string };
    expect(json.access_token).toBeDefined();
    expect(json.token_type).toBeDefined();
    pat = `${json.token_type} ${json.access_token}`;
  });

  it('sets up the initial source test data.', async(): Promise<void> => {
    // Policy that allows the creation of the initial resources
    const policy = `
    @prefix ex: <http://example.org/12345#> .
    @prefix odrl: <http://www.w3.org/ns/odrl/2/> .

    ex:createPolicy a odrl:Agreement ;
                   odrl:uid ex:createPolicy ;
                   odrl:permission ex:createPermission .
    ex:createPermission a odrl:Permission ;
                  odrl:action odrl:create ;
                  odrl:target <${container}> ;
                  odrl:assignee <${user}> ;
                  odrl:assigner <${user}> .
    `;

    // Create policy
    const url = `http://localhost:${srcUmaPort}/uma/policies`;
    let response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `WebID ${encodeURIComponent(user)}`, 'content-type': 'text/turtle' },
      body: policy,
    });
    expect(response.status).toBe(201);

    // Create resource
    response = await umaFetch(target, {
      method: 'PUT',
      headers: { 'content-type': 'plain/text' },
      body: 'this is test data',
    }, user);
    expect(response.status).toBe(201);
  });

  it('can set up the policies for the aggregator.', async(): Promise<void> => {
    const policy = `
    @prefix ex: <http://example.org/12345#> .
    @prefix odrl: <http://www.w3.org/ns/odrl/2/> .

    ex:aggregatorPolicy a odrl:Agreement ;
                   odrl:uid ex:aggregatorPolicy ;
                   odrl:permission ex:aggregatorPermission .
    ex:aggregatorPermission a odrl:Permission ;
                  odrl:action odrl:read ;
                  odrl:target <${target}> ;
                  odrl:assignee <${aggregator}> ;
                  odrl:assigner <${user}> .
    `;

    // Create policy
    const url = `http://localhost:${srcUmaPort}/uma/policies`;
    let response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `WebID ${encodeURIComponent(user)}`, 'content-type': 'text/turtle' },
      body: policy,
    });
    expect(response.status).toBe(201);
  });

  it('can register the aggregator resource.', async(): Promise<void> => {
    const description: ResourceDescription = {
      name: `http://localhost:${aggregatorPort}/resource`,
      resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ],
    };
    const response = await fetch(aggConfig.resource_registration_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': pat,
      },
      body: JSON.stringify(description),
    });
    expect(response.status).toBe(201);
    const { _id: umaId } = await response.json() as { _id: string };
    expect(umaId).toBeDefined;
    aggregatedResourceId = umaId;
  });

  it('can get the derivation ID of a resource.', async(): Promise<void> => {
    // Parse ticket and UMA server URL from header
    const parsedHeader = await noTokenFetch(target);

    // Find UMA server token endpoint
    const configurationUrl = parsedHeader.as_uri + '/.well-known/uma2-configuration';
    const configResponse = await fetch(configurationUrl);
    expect(configResponse.status).toBe(200);
    srcConfig = await configResponse.json() as UmaConfig;

    // Send ticket request to UMA server and extract token from response
    // This will fail because the policy does not (yet) allow `urn:knows:uma:scopes:derivation-creation`,
    // only `odrl:read`.
    const content: Record<string, string> = {
      grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
      ticket: parsedHeader.ticket,
      claim_token: encodeURIComponent(aggregator),
      claim_token_format: 'urn:solidlab:uma:claims:formats:webid',
      scope: 'urn:knows:uma:scopes:derivation-creation',
    };
    let response = await fetch(srcConfig.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(content),
    });
    expect(response.status).toBe(403);
    const errorJson = await response.json() as { ticket: string, required_claims: { resource_scopes: string[] }[] };
    expect(errorJson.required_claims).toEqual([{ resource_scopes: [ 'urn:knows:uma:scopes:derivation-creation' ] }]);
    previousTicket = errorJson.ticket;
  });

  it('can get the derivation_id when having derivation-creation permissions.', async(): Promise<void> => {
    // Update policy to also support derivation-creation
    const policy = `
    @prefix ex: <http://example.org/12345#> .
    @prefix odrl: <http://www.w3.org/ns/odrl/2/> .

    ex:aggregatorPolicy a odrl:Agreement ;
                   odrl:uid ex:aggregatorPolicy ;
                   odrl:permission ex:aggregatorPermission .
    ex:aggregatorPermission a odrl:Permission ;
                  odrl:action odrl:read , <urn:knows:uma:scopes:derivation-creation> ;
                  odrl:target <${target}> ;
                  odrl:assignee <${aggregator}> ;
                  odrl:assigner <${user}> .
    `;

    // Create policy
    const url = `http://localhost:${srcUmaPort}/uma/policies/${encodeURIComponent('http://example.org/12345#aggregatorPolicy')}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: { authorization: `WebID ${encodeURIComponent(user)}`, 'content-type': 'text/turtle' },
      body: policy,
    });
    expect(response.status).toBe(204);

    const token = await getToken(previousTicket, srcConfig.token_endpoint, aggregator,
      'urn:knows:uma:scopes:derivation-creation');
    expect(token.derivation_resource_id).toBeDefined();
    derivationId = token.derivation_resource_id!;
  });

  it('can update the aggregator resource registration with the derived_from id.', async(): Promise<void> => {
    // Update registration with derivation ID
    const description: ResourceDescription = {
      name: `http://localhost:${aggregatorPort}/resource`,
      resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ],
      derived_from: [{
        issuer: srcConfig.issuer,
        derivation_resource_id: derivationId,
      }]
    };
    const url = joinUrl(aggConfig.resource_registration_endpoint, encodeURIComponent(aggregatedResourceId));
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': pat,
      },
      body: JSON.stringify(description),
    });
    expect(response.status).toBe(200);
  });

  it('can read the resource registration on the AS.', async(): Promise<void> => {
    let response = await fetch(aggConfig.resource_registration_endpoint, {
      headers: { authorization: pat }
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([aggregatedResourceId]);

    const url = joinUrl(aggConfig.resource_registration_endpoint, encodeURIComponent(aggregatedResourceId));
    response = await fetch(url, {
      headers: { authorization: pat  },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      name: `http://localhost:${aggregatorPort}/resource`,
      resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ],
      derived_from: [{
        issuer: srcConfig.issuer,
        derivation_resource_id: derivationId,
      }],
    });
  });

  it('a client cannot read an aggregated resource without the necessary tokens.', async(): Promise<void> => {
    // We don't have an actual aggregator server so simulating the request
    const body = [{
      resource_id: aggregatedResourceId,
      resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ],
    }];
    let response = await fetch(aggConfig.permission_endpoint, {
      method: 'POST',
      headers: {
        'Authorization': pat,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(201);
    const { ticket } = await response.json() as { ticket: string };
    expect(ticket).toBeDefined();

    // This will fail because the derivation_read access token is missing
    const content: Record<string, string> = {
      grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
      ticket: ticket,
      claim_token: encodeURIComponent(user),
      claim_token_format: 'urn:solidlab:uma:claims:formats:webid'
    };
    response = await fetch(aggConfig.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(content),
    });
    expect(response.status).toBe(403);
    const errorJson = await response.json() as { ticket: string, required_claims: RequiredClaim[] };
    previousTicket = errorJson.ticket;
    expect(errorJson.required_claims).toHaveLength(1);
    expect(errorJson.required_claims[0].claim_token_format).toBe('urn:ietf:params:oauth:token-type:access_token');
    expect(errorJson.required_claims[0].issuer).toBe(srcConfig.issuer);
    expect(errorJson.required_claims[0].derivation_resource_id).toBe(derivationId);
    expect(errorJson.required_claims[0].resource_scopes).toEqual(['urn:knows:uma:scopes:derivation-read']);
  });

  it('the client can request a derivation-read access token from the source AS.', async(): Promise<void> => {
    const content = {
      grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
      claim_token: encodeURIComponent(user),
      claim_token_format: 'urn:solidlab:uma:claims:formats:webid',
      permissions: [{
        resource_id: derivationId,
        resource_scopes: [ 'urn:knows:uma:scopes:derivation-read' ],
      }],
    };
    let response = await fetch(srcConfig.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(content),
    });
    // Rejected because there is no policy in place yet
    expect(response.status).toBe(403);

    // Add policy allowing derivation-read access
    const policy = `
    @prefix ex: <http://example.org/12345#> .
    @prefix odrl: <http://www.w3.org/ns/odrl/2/> .

    ex:userPolicy a odrl:Agreement ;
                   odrl:uid ex:userPolicy ;
                   odrl:permission ex:userPermission .
    ex:userPermission a odrl:Permission ;
                  odrl:action <urn:knows:uma:scopes:derivation-read> ;
                  odrl:target <${target}> ;
                  odrl:assignee <${user}> ;
                  odrl:assigner <${user}> .
    `;

    // Create policy
    const url = `http://localhost:${srcUmaPort}/uma/policies`;
    response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `WebID ${encodeURIComponent(user)}`, 'content-type': 'text/turtle' },
      body: policy,
    });
    expect(response.status).toBe(201);

    // Token request should now succeed
    response = await fetch(srcConfig.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(content),
    });
    expect(response.status).toBe(200);
    const tokenJson = await response.json() as { access_token: string, token_type: string };
    accessToken = tokenJson.access_token;
  });

  it('the client can not read the aggregated resource if no policy allows this.', async(): Promise<void> => {
    const content = {
      grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
      ticket: previousTicket,
      claim_token: [
        { claim_token: encodeURIComponent(user), claim_token_format: 'urn:solidlab:uma:claims:formats:webid' },
        { claim_token: accessToken, claim_token_format: 'urn:ietf:params:oauth:token-type:access_token' }
      ],
    };
    const response = await fetch(aggConfig.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(content),
    });
    expect(response.status).toBe(403);
  });

  it('the client can read the aggregated resource with valid tokens and policy.', async(): Promise<void> => {
    // Set the policy
    const policy = `
    @prefix ex: <http://example.org/12345#> .
    @prefix odrl: <http://www.w3.org/ns/odrl/2/> .

    ex:userPolicy a odrl:Agreement ;
                   odrl:uid ex:userPolicy ;
                   odrl:permission ex:userPermission .
    ex:userPermission a odrl:Permission ;
                  odrl:action odrl:read ;
                  odrl:target <${aggregatedResourceId}> ;
                  odrl:assignee <${user}> ;
                  odrl:assigner <${user}> .
    `;

    // Create policy
    const url = `http://localhost:${aggUmaPort}/uma/policies`;
    let response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `WebID ${encodeURIComponent(user)}`, 'content-type': 'text/turtle' },
      body: policy,
    });
    expect(response.status).toBe(201);

    // Getting the ticket
    const body = [{
      resource_id: aggregatedResourceId,
      resource_scopes: [ 'http://www.w3.org/ns/odrl/2/read' ],
    }];
    response = await fetch(aggConfig.permission_endpoint, {
      method: 'POST',
      headers: {
        'Authorization': pat,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(201);
    const { ticket } = await response.json() as { ticket: string };
    expect(ticket).toBeDefined();

    // Getting the access token
    const content = {
      grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
      ticket: ticket,
      claim_token: [
        { claim_token: encodeURIComponent(user), claim_token_format: 'urn:solidlab:uma:claims:formats:webid' },
        { claim_token: accessToken, claim_token_format: 'urn:ietf:params:oauth:token-type:access_token' },
      ],
    };
    response = await fetch(aggConfig.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(content),
    });
    expect(response.status).toBe(200);
    const json = await response.json() as { access_token: string };
    expect (json.access_token).toBeDefined();
  });
});
