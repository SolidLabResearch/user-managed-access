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

  log("This flow defines the retrieval by a doctor of this resource.")

  log('The patient has synced some data with his pod at http://localhost:3000/ruben/medical/smartwatch.ttl');

  log('To protect this data, a policy is added restricting access to a specific healthcare employee for the purpose of bariatric care');
  log('Note: policy management is out of scope for POC1')
  
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

  log("Set the following policy:", healthcare_patient_policy)
  log("----------------------------------------------------")

  if (medicalPolicyCreationResponse.status !== 201) { log('Adding a policy did not succeed...'); throw 0; }

  log(`This policy assigns access to the person's house doctor ${terms.agents.alice} for the smartwatch resource, 
requiring the purpose of the request to equal "http://example.org/bariatric-care"
and the legal basis to equal "https://w3id.org/dpv/legal/eu/gdpr#A9-2-a"`)

  log("The house doctor in question now wants to access the private user resource.")

  // todo: this should be a resource request. Maybe something broke but I couldn't get a ticket via a direct resource request.

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
  }
  
  log("First the doctor sends a ticket request to the authorization server (shortcut routine)", smartWatchAccessRequestNoClaimsODRL)

  const doctor_needInfoResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(smartWatchAccessRequestNoClaimsODRL),
  });
  
  if (doctor_needInfoResponse.status !== 403) { log('Access request succeeded without claims...', await doctor_needInfoResponse.text()); throw 0; }

  const { ticket, required_claims: doctor_claims } = await doctor_needInfoResponse.json();
  
  log(`Based on the policy, the UMA server requests the following claims from the agent:`);
  doctor_claims.claim_token_format[0].forEach((format: string) => log(`  - ${format}`))
  log(`accompanied by a ticket for the interaction: ${ticket}.`)

  // JWT (HS256; secret: "ceci n'est pas un secret")
  // {
  //   "http://www.w3.org/ns/odrl/2/purpose": "http://example.org/bariatric-care",
  //   "urn:solidlab:uma:claims:types:webid": "http://localhost:3000/alice/profile/card#me",
  //   "https://w3id.org/oac#LegalBasis": "https://w3id.org/dpv/legal/eu/gdpr#A9-2-a"
  // }
  const claim_token = "eyJhbGciOiJIUzI1NiJ9.eyJodHRwOi8vd3d3LnczLm9yZy9ucy9vZHJsLzIvcHVycG9zZSI6Imh0dHA6Ly9leGFtcGxlLm9yZy9iYXJpYXRyaWMtY2FyZSIsInVybjpzb2xpZGxhYjp1bWE6Y2xhaW1zOnR5cGVzOndlYmlkIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL2FsaWNlL3Byb2ZpbGUvY2FyZCNtZSIsImh0dHBzOi8vdzNpZC5vcmcvb2FjI0xlZ2FsQmFzaXMiOiJodHRwczovL3czaWQub3JnL2Rwdi9sZWdhbC9ldS9nZHByI0E5LTItYSJ9.nT55jaXNDsHgAo_zcRMsbJqcNj4FVdW_-xjcwNam-1M"

  const claims: any = {
    "http://www.w3.org/ns/odrl/2/purpose": "http://example.org/bariatric-care",
    "urn:solidlab:uma:claims:types:webid": "http://localhost:3000/alice/profile/card#me",
    "https://w3id.org/oac#LegalBasis": "https://w3id.org/dpv/legal/eu/gdpr#A9-2-a"
  }

  log(`The agent gathers the necessary claims (the manner in which is out-of-scope for this demo)`, claims)

  log(`and bundles them as an UMA-compliant JWT.`, {
    claim_token: claim_token,
    claim_token_format: "urn:solidlab:uma:claims:formats:jwt"
  })

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
      claim_token: claim_token, 
      claim_token_format: "urn:solidlab:uma:claims:formats:jwt",
    // }],
    // UMA specific fields
    grant_type: "urn:ietf:params:oauth:grant-type:uma-ticket",
    ticket,
  }

  log('Together with the UMA grant_type and ticket requirements, these are bundled as an ODRL Request and sent back to the Authorization Server', smartWatchAccessRequestODRL)
  
  log('Note that the ODRL constraints are not yet processed as claims, only the ODRL claim_token(_format) flow.')

  const accessGrantedResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(smartWatchAccessRequestODRL)
  });

  if (accessGrantedResponse.status !== 200) { 
    log('Access request failed despite policy...', JSON.stringify(await accessGrantedResponse.json(), null, 2)); throw 0; 
  }

  const tokenParams = await accessGrantedResponse.json();

  log(`The UMA server checks the claims with the relevant policy, and returns the agent an access token with the requested permissions.`, 
    JSON.stringify(parseJwt(tokenParams.access_token).permissions, null, 2));
  
  log(`and the accompanying agreement:`, 
    JSON.stringify(parseJwt(tokenParams.access_token).contract, null, 2));
    
  
  const accessWithTokenResponse = await fetch(terms.resources.smartwatch, {
    headers: { 'Authorization': `${tokenParams.token_type} ${tokenParams.access_token}` }
  });

  log(`Now the doctor can retrieve the resource:`, await accessWithTokenResponse.text());

  if (accessWithTokenResponse.status !== 200) { log(`Access with token failed...`); throw 0; }
  
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

