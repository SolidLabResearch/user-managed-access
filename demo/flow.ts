/* eslint-disable max-len */

import { fetch } from 'cross-fetch';
import { Parser, Writer, Store } from 'n3';
// import { demoPolicy } from "./policyCreation";
import { randomUUID } from 'crypto';

const parser = new Parser();
const writer = new Writer();

const terms = {
  solid: {
    umaServer: 'http://www.w3.org/ns/solid/terms#umaServer',
    viewIndex: 'http://www.w3.org/ns/solid/terms#viewIndex',
    entry: 'http://www.w3.org/ns/solid/terms#entry',
    filter: 'http://www.w3.org/ns/solid/terms#filter',
    location: 'http://www.w3.org/ns/solid/terms#location',
  },
  filters: {
    bday: 'http://localhost:3000/catalog/public/filters/bday',
    age: 'http://localhost:3000/catalog/public/filters/age',
  },
  views: {
    bday: 'http://localhost:3000/ruben/private/derived/bday',
    age: 'http://localhost:3000/ruben/private/derived/age',
  },
  resources: {
    smartwatch: 'http://localhost:3000/ruben/medical/smartwatch.ttl'
  },
  agents: {
    ruben: 'http://localhost:3000/ruben/profile/card#me',
    alice: 'http://localhost:3000/alice/profile/card#me',
    vendor: 'http://localhost:3000/demo/public/vendor',
    present: 'http://localhost:3000/demo/public/bday-app',
  },
  scopes: {
    read: 'urn:example:css:modes:read',
  }
}

const policyContainer = 'http://localhost:3000/ruben/settings/policies/';

async function main() {

  const webIdData = new Store(parser.parse(await (await fetch(terms.agents.ruben)).text()));
  
  const umaServer = webIdData.getObjects(terms.agents.ruben, terms.solid.umaServer, null)[0].value;
  const configUrl = new URL('.well-known/uma2-configuration', umaServer);
  const umaConfig = await (await fetch(configUrl)).json();
  const tokenEndpoint = umaConfig.token_endpoint;


  log('')
  log('=================== UMA prototype flow ======================')

  log("Doctor Alice will try to Read patient data from Ruben's pod")

  log('Ruben V syncs his smartwatch data with his pod at /medical/smartwatch.ttl');

  log('To protect this data, a policy is added restricting access to a specific healthcare employee for the purpose of bariatric care');
  
  const healthcare_patient_policy = `
  PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX eu-gdpr: <https://w3id.org/dpv/legal/eu/gdpr#>
PREFIX oac: <https://w3id.org/oac#>
PREFIX odrl: <http://www.w3.org/ns/odrl/2/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

PREFIX ex: <http://example.org/>

<http://example.org/HCPX-request> a odrl:Request ;
    odrl:uid ex:HCPX-request ;
    odrl:profile oac: ;
    dcterms:description "HCP X requests to read Alice's health data for bariatric care.";
    odrl:permission <http://example.org/HCPX-request-permission> .

<http://example.org/HCPX-request-permission> a odrl:Permission ;
    odrl:action odrl:read ;
    odrl:target <${terms.resources.smartwatch}> ;
    odrl:assigner <${terms.agents.ruben}> ;
    odrl:assignee <${terms.agents.alice}> ;
    odrl:constraint <http://example.org/HCPX-request-permission-purpose>,
        <http://example.org/HCPX-request-permission-lb> .

<http://example.org/HCPX-request-permission-purpose> a odrl:Constraint ;
    odrl:leftOperand odrl:purpose ; # can also be oac:Purpose, to conform with OAC profile
    odrl:operator odrl:eq ;
    odrl:rightOperand ex:bariatric-care .

<http://example.org/HCPX-request-permission-lb> a odrl:Constraint ;
    odrl:leftOperand oac:LegalBasis ;
    odrl:operator odrl:eq ;
    odrl:rightOperand eu-gdpr:A9-2-a .`

  const medicalPolicyCreationResponse = await fetch(policyContainer, {
    method: 'POST',
    headers: { 'content-type': 'text/turtle' },
    body: healthcare_patient_policy,
  });

  if (medicalPolicyCreationResponse.status !== 201) { log('Adding a policy did not succeed...'); throw 0; }

  log("The house doctor assigned access to this data for the purpose of bariatric care, now tries to access this data.")

  log("First the doctor sends a resource request to get a ticket")

  const smartWatchAccessRequestNoClaimsODRL = {
    "@context": "http://www.w3.org/ns/odrl.jsonld",
    "@type": "Request",
    profile: { "@id": "https://w3id.org/oac#" },
    uid: `http://example.org/HCPX-request/${randomUUID()}`,
    description: "HCP X requests to read Alice's health data for bariatric care.",
    permission: {
      "@type": "Permission",
      "@id": `http://example.org/HCPX-request-permission/${randomUUID()}`,
      target: terms.resources.smartwatch,
      action: { "@id": "https://w3id.org/oac#read" },
    },
    permissions: [{
      resource_id: terms.resources.smartwatch,
      resource_scopes: [ terms.scopes.read ],
    }]
  }

  const doctor_needInfoResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(smartWatchAccessRequestNoClaimsODRL),
  });
  
  if (doctor_needInfoResponse.status !== 403) { log('Access request succeeded without claims...'); throw 0; }

  const { ticket: doctor_ticket, required_claims: doctor_claims } = await doctor_needInfoResponse.json();
  
  log(`The doctor receives the UMA ticket ${doctor_ticket}, and a set of required claims: ${JSON.stringify(doctor_claims, null, 2)}`)

  log(`Based on the policy, the UMA server requests the following claims from the agent:`);
  doctor_claims.claim_token_format[0].forEach((format: string) => log(`  - ${format}`))

  // Example false claims
  // {
  //   "http://www.w3.org/ns/odrl/2/purpose": "http://example.org/advertisement",
  //   "urn:solidlab:uma:claims:types:webid": "http://localhost:3000/alice/profile/card#me",
  //   "https://w3id.org/oac#LegalBasis":  "https://w3id.org/dpv/legal/eu/gdpr#A9-2-a"
  // }
  // const claim_token = "eyJhbGciOiJIUzI1NiJ9.eyJodHRwOi8vd3d3LnczLm9yZy9ucy9vZHJsLzIvcHVycG9zZSI6Imh0dHA6Ly9leGFtcGxlLm9yZy9hZHZlcnRpc2VtZW50IiwidXJuOnNvbGlkbGFiOnVtYTpjbGFpbXM6dHlwZXM6d2ViaWQiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAvYWxpY2UvcHJvZmlsZS9jYXJkI21lIiwiaHR0cHM6Ly93M2lkLm9yZy9vYWMjTGVnYWxCYXNpcyI6Imh0dHBzOi8vdzNpZC5vcmcvZHB2L2xlZ2FsL2V1L2dkcHIjQTktMi1hIn0.AYM5t4gTayckxDXwvnhxybZ0rWPz4qNQD5WBUqrY2Z0"


  // JWT (HS256; secret: "ceci n'est pas un secret")
  // {
  //   "http://www.w3.org/ns/odrl/2/purpose": "http://example.org/bariatric-care",
  //   "urn:solidlab:uma:claims:types:webid": "http://localhost:3000/alice/profile/card#me",
  //   "https://w3id.org/oac#LegalBasis": "https://w3id.org/dpv/legal/eu/gdpr#A9-2-a"
  // }
  const claim_token = "eyJhbGciOiJIUzI1NiJ9.eyJodHRwOi8vd3d3LnczLm9yZy9ucy9vZHJsLzIvcHVycG9zZSI6Imh0dHA6Ly9leGFtcGxlLm9yZy9iYXJpYXRyaWMtY2FyZSIsInVybjpzb2xpZGxhYjp1bWE6Y2xhaW1zOnR5cGVzOndlYmlkIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL2FsaWNlL3Byb2ZpbGUvY2FyZCNtZSIsImh0dHBzOi8vdzNpZC5vcmcvb2FjI0xlZ2FsQmFzaXMiOiJodHRwczovL3czaWQub3JnL2Rwdi9sZWdhbC9ldS9nZHByI0E5LTItYSJ9.nT55jaXNDsHgAo_zcRMsbJqcNj4FVdW_-xjcwNam-1M"

  log(`The agent gathers the necessary claims (the manner in which is out-of-scope for this demo), and sends them to the UMA server as a JWT.`)


  const smartWatchAccessRequestODRL = {
    "@context": "http://www.w3.org/ns/odrl.jsonld",
    "@type": "Request",
    profile: { "@id": "https://w3id.org/oac#" },
    uid: `http://example.org/HCPX-request/${randomUUID()}`,
    description: "HCP X requests to read Alice's health data for bariatric care.",
    permission: {
      "@type": "Permission",
      "@id": `http://example.org/HCPX-request-permission/${randomUUID()}`,
      target: terms.resources.smartwatch,
      action: { "@id": "https://w3id.org/oac#read" },
      constraint: [
        {
          "@type": "Constraint",
          "@id": `http://example.org/HCPX-request-permission-purpose/${randomUUID()}`,
          leftOperand: "purpose",
          operator: "eq",
          rightOperand: { "@id": "http://example.org/bariatric-care" },
        }, {
          "@type": "Constraint",
          "@id": `http://example.org/HCPX-request-permission-purpose/${randomUUID()}`,
          leftOperand: { "@id": "https://w3id.org/oac#LegalBasis" },
          operator: "eq",
          rightOperand: {"@id": "https://w3id.org/dpv/legal/eu/gdpr#A9-2-a" },
        }
      ],
    },
    // claims: [{
      claim_token: claim_token, // encodeURIComponent(terms.agents.alice),
      claim_token_format: "urn:solidlab:uma:claims:formats:jwt", // 'urn:solidlab:uma:claims:formats:webid',
    // }],
    // UMA specific fields
    permissions: [{
      resource_id: terms.resources.smartwatch,
      resource_scopes: [ terms.scopes.read ],
    }],
    grant_type: "urn:ietf:params:oauth:grant-type:uma-ticket",
    ticket: doctor_ticket,
  }

  console.log("COPY", JSON.stringify(smartWatchAccessRequestODRL, null, 2))

  const accessGrantedResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(smartWatchAccessRequestODRL)
  });

  if (accessGrantedResponse.status !== 200) { 
    log('Access request failed despite policy...', JSON.stringify(await accessGrantedResponse.json(), null, 2)); throw 0; 
  }

  log(`The UMA server checks the claims with the relevant policy, and returns the agent an access token with the requested permissions.`);
  
  const tokenParams = await accessGrantedResponse.json();

  log ("tokenParams", tokenParams)
  const accessWithTokenResponse = await fetch(terms.resources.smartwatch, {
    headers: { 'Authorization': `${tokenParams.token_type} ${tokenParams.access_token}` }
  });
  console.log(await accessWithTokenResponse.text())

  if (accessWithTokenResponse.status !== 200) { log(`Access with token failed...`); throw 0; }

  log(`The agent can then use this access token at the Resource Server to perform the desired action.`);
  
}

main();


/* Helper functions */

function parseJwt (token:string) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

function log(msg: string, obj?: any) {
  console.log('');
  console.log(msg);
  if (obj) {
    console.log('\n');
    console.log(obj);
  }
}

// creates the container if it does not exist yet (only when access is there)
async function initContainer(policyContainer: string): Promise<void> {
  const res = await fetch(policyContainer)
  if (res.status === 404) {
    const res = await fetch(policyContainer, {
      method: 'PUT'
    })
    if (res.status !== 201) {
      log('Creating container at ' + policyContainer + ' not successful'); throw 0;
    }
  }
}

