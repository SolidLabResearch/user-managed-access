import { App } from '@solid/community-server';
import { setGlobalLoggerFactory, WinstonLoggerFactory } from 'global-logger-factory';
import { UnsecuredJWT } from 'jose';
import * as path from 'node:path';
import { getDefaultCssVariables, getPorts, instantiateFromConfig } from '../util/ServerUtil';
import { findTokenEndpoint, generateCredentials, getToken, noTokenFetch, tokenFetch, umaFetch } from '../util/UmaUtil';

const [ cssPort, umaPort ] = getPorts('Demo');

const terms = {
  solid: {
    umaServer: 'http://www.w3.org/ns/solid/terms#umaServer',
  },
  resources: {
    smartwatch: `http://localhost:${cssPort}/ruben/medical/smartwatch.ttl`
  },
  agents: {
    ruben: `http://localhost:${cssPort}/ruben/profile/card#me`,
    alice: `http://localhost:${cssPort}/alice/profile/card#me`,
  }
}

describe('A demo server setup', (): void => {
  let umaApp: App;
  let cssApp: App;
  const policyContainer = `http://localhost:${cssPort}/settings/policies/`;

  beforeAll(async(): Promise<void> => {
    setGlobalLoggerFactory(new WinstonLoggerFactory('off'));

    umaApp = await instantiateFromConfig(
      'urn:uma:default:App',
      path.join(__dirname, '../../packages/uma/config/demo.json'),
      {
        'urn:uma:variables:port': umaPort,
        'urn:uma:variables:baseUrl': `http://localhost:${umaPort}/uma`,
        'urn:uma:variables:policyContainer': policyContainer,
        'urn:uma:variables:backupFilePath': '',
      }
    );

    cssApp = await instantiateFromConfig(
      'urn:solid-server:default:App',
      // Not using the demo config as that one writes to disk, this is the same but in memory
      [
        path.join(__dirname, '../../packages/css/config/default.json'),
        path.join(__dirname, '../../packages/css/config/uma/demo.json'),
      ],
      {
        ...getDefaultCssVariables(cssPort),
        'urn:solid-server:default:variable:seedConfig':  path.join(__dirname, '../../demo/seed.json'),
      },
    );

    await Promise.all([umaApp.start(), cssApp.start()]);
  });

  afterAll(async(): Promise<void> => {
    await Promise.all([ umaApp.stop(), cssApp.stop() ]);
  });

  it('can register a PAT for the user.', async(): Promise<void> => {
    await generateCredentials({
      webId: `http://localhost:${cssPort}/ruben/profile/card#me`,
      authorizationServer: `http://localhost:${umaPort}/uma`,
      resourceServer: `http://localhost:${cssPort}/`,
      email: 'ruben@example.org',
      password: 'abc123'
    });
  });

  it('sets up the initial data.', async(): Promise<void> => {
    // Policy that allows the creation of all the initial resources
    const policy = `
    @prefix ex: <http://example.org/12345#> .
    @prefix odrl: <http://www.w3.org/ns/odrl/2/> .

    ex:usagePolicy a odrl:Agreement ;
                   odrl:permission ex:permission .
    ex:permission a odrl:Permission ;
                  odrl:action odrl:create, odrl:modify ;
                  odrl:target <http://localhost:${cssPort}/ruben/> ,
                              <http://localhost:${cssPort}/ruben/medical/> ,
                              <http://localhost:${cssPort}/ruben/medical/smartwatch.ttl> ,
                              <http://localhost:${cssPort}/ruben/private/> ,
                              <http://localhost:${cssPort}/ruben/private/data> ;
                  odrl:assignee <${terms.agents.ruben}> ;
                  odrl:assigner <${terms.agents.ruben}> .
    `;

    // Create policy
    let response = await fetch(`http://localhost:${cssPort}/settings/policies/policy`, {
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body: policy,
    });
    expect(response.status).toBe(201);

    // Create smartwatch data
    response = await umaFetch(`http://localhost:${cssPort}/ruben/medical/smartwatch.ttl`, {
      method: 'PUT',
      headers: { 'content-type': 'application/trig' },
      body: '<this> <is> <smartwatch> <data>.',
    }, terms.agents.ruben);
    expect(response.status).toBe(201);

    // Create private data
    response = await umaFetch(`http://localhost:${cssPort}/ruben/private/data`, {
      method: 'PUT',
      headers: { 'content-type': 'text/turtle' },
      body: `
@prefix dbo: <http://dbpedia.org/ontology/>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.

<https://ruben.verborgh.org/profile/#me> dbo:birthDate "1987-02-28"^^xsd:date .`,
    }, terms.agents.ruben);
    expect(response.status).toBe(201);

    // Create derived resources.
    // This is outdated and not actually needed for the test,
    // but this did cause a bug about auxiliary resources to be discovered,
    // so it should stay until there is a specific test for those.
    response = await umaFetch(`http://localhost:${cssPort}/ruben/private/.meta`, {
      method: 'PATCH',
      headers: { 'content-type': 'text/n3' },
      body: `
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix ex: <http://www.example.org/terms#>.
@prefix derived: <urn:npm:solid:derived-resources:> .

_:rename a solid:InsertDeletePatch;
  solid:inserts {
    <http://localhost:${cssPort}/ruben/private/> derived:derivedResource ex:bday.
    ex:bday derived:template "derived/bday";
            derived:selector <http://localhost:${cssPort}/ruben/private/data>;
            derived:filter <http://localhost:${cssPort}/catalog/public/filters/bday>.

    <http://localhost:${cssPort}/ruben/private/> derived:derivedResource ex:age.
    ex:age derived:template "derived/age";
           derived:selector <http://localhost:${cssPort}/ruben/private/data>;
           derived:filter <http://localhost:${cssPort}/catalog/public/filters/age>.
  }.`,
    }, terms.agents.ruben);
    expect(response.status).toBe(205);
  });

  it('can add a healthcare policy to the server.', async(): Promise<void> => {
    const healthcare_patient_policy =
      `PREFIX dcterms: <http://purl.org/dc/terms/>
       PREFIX eu-gdpr: <https://w3id.org/dpv/legal/eu/gdpr#>
       PREFIX oac: <https://w3id.org/oac#>
       PREFIX odrl: <http://www.w3.org/ns/odrl/2/>
       PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
       
       PREFIX ex: <http://example.org/>

       <http://example.org/HCPX-agreement> a odrl:Agreement ;
         odrl:uid ex:HCPX-agreement ;
         odrl:profile oac: ;
         odrl:permission <http://example.org/HCPX-agreement-permission> .
      
       <http://example.org/HCPX-agreement-permission> a odrl:Permission ;
         odrl:action odrl:read ;
         odrl:target <${terms.resources.smartwatch}> ;
         odrl:assigner <${terms.agents.ruben}> ;
         odrl:assignee <${terms.agents.alice}> ;
         odrl:constraint <http://example.org/HCPX-agreement-permission-purpose>,
                         <http://example.org/HCPX-agreement-permission-lb> .
      
       <http://example.org/HCPX-agreement-permission-purpose> a odrl:Constraint ;
         odrl:leftOperand odrl:purpose ;
         odrl:operator odrl:eq ;
         odrl:rightOperand ex:bariatric-care .
      
       <http://example.org/HCPX-agreement-permission-lb> a odrl:Constraint ;
         odrl:leftOperand oac:LegalBasis ;
         odrl:operator odrl:eq ;
         odrl:rightOperand eu-gdpr:A9-2-a .`

    const medicalPolicyCreationResponse = await fetch(policyContainer, {
      method: 'POST',
      headers: { 'content-type': 'text/turtle' },
      body: healthcare_patient_policy,
    });
    expect(medicalPolicyCreationResponse.status).toBe(201);
  });

  it('requires authorized access for patient data.', async(): Promise<void> => {
    // Parse ticket and UMA server URL from header
    const parsedHeader = await noTokenFetch(terms.resources.smartwatch);

    // Find UMA server token endpoint
    const tokenEndpoint = await findTokenEndpoint(parsedHeader.as_uri);

    const jwt = new UnsecuredJWT({
      'http://www.w3.org/ns/odrl/2/purpose': 'http://example.org/bariatric-care',
      'urn:solidlab:uma:claims:types:webid': terms.agents.alice,
      'https://w3id.org/oac#LegalBasis': 'https://w3id.org/dpv/legal/eu/gdpr#A9-2-a'
    }).encode();

    // Send ticket request to UMA server and extract token from response
    const token = await getToken(
      parsedHeader.ticket,
      tokenEndpoint,
      undefined,
      undefined,
      [{ claim_token: jwt, claim_token_format: 'urn:solidlab:uma:claims:formats:jwt' }]);
    const accessToken = JSON.parse(Buffer.from(token.access_token.split('.')[1], 'base64').toString());
    expect(accessToken).toMatchObject({
      permissions:[{
        resource_id: terms.resources.smartwatch,
        resource_scopes: [ 'urn:example:css:modes:read' ]
      }],
      iat: expect.any(Number),
      iss: `http://localhost:${umaPort}/uma`,
      aud: 'solid',
      exp: expect.any(Number),
      jti: expect.any(String),
    });

    // Perform new call with token
    const response = await tokenFetch(token, terms.resources.smartwatch);
    expect(response.status).toBe(200);
  });
});
