#!/usr/bin/env ts-node

import { fetch } from 'cross-fetch'
import { randomUUID } from 'crypto';


function parseJwt (token:string) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

async function main() {
  // Resource and WebID as set in config/rules/policy/policy0.ttl
  const patientResource = "http://localhost:3000/alice/private/resource.txt";
  const patientWebID = "http://localhost:3000/alice/profile/card#me";
  const hcpWebId = "http://localhost:3000/healthcareprovider/profile/card#me";

  const as_resource_creation_request =  {
    '@context': [
      'http://www.w3.org/ns/odrl/2/', 
      'http://purl.org/dc/terms/',
      'https://w3id.org/oac#',
      'https://w3id.org/dpv/legal/eu/gdpr#',
      'http://example.org/ns/UMA/'
    ],
    '@type': 'Request',
    profile: { '@id': 'oac' },
    uid: `http://example.org/HCPX-request/${randomUUID()}`,
    description: `Patient ${patientWebID} creates a healthcare resource.`,
    permission: {
        '@type': 'Permission',
        '@id': `http://example.org/HCPX-resource-creation/${randomUUID()}`,
        assigner: patientWebID,
        assignee: patientWebID,
        target: patientResource,
        action: { '@id': 'write' },
    },
    // claims: [{
    claim_token: encodeURIComponent(patientWebID),
    claim_token_format: 'urn:solidlab:uma:claims:formats:webid',
    // }],
    grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket'
  };

  await authenticatedPost(patientResource, patientWebID, as_resource_creation_request, "Medical data ...")



  const as_resource_read_request =  {
    '@context': [
      'http://www.w3.org/ns/odrl/2/', 
      'http://purl.org/dc/terms/',
      'https://w3id.org/oac#',
      'https://w3id.org/dpv/legal/eu/gdpr#',
      'http://example.org/ns/UMA/'
    ],
    '@type': 'Request',
    profile: { '@id': 'oac' },
    uid: `http://example.org/HCPX-request/${randomUUID()}`,
    description: `Patient ${patientWebID} reads their own healthcare resource.`,
    permission: {
        '@type': 'Permission',
        '@id': `http://example.org/HCPX-resource-creation/${randomUUID()}`,
        assigner: patientWebID,
        assignee: patientWebID,
        target: patientResource,
        action: { '@id': 'read' },
    },
    // claims: [{
    claim_token: encodeURIComponent(patientWebID),
    claim_token_format: 'urn:solidlab:uma:claims:formats:webid',
    // }],
    grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket'
  };

  await authenticatedGet(patientResource, patientWebID, as_resource_read_request)


  
}

async function authenticatedPost(resource: string, webId: string, as_request_content: any, body: string) {

  const request: RequestInit = { 
    method: "PUT", 
    headers: {},
    body: 'Medical Data ...' ,
  };

  console.log('\n\n');

  console.log(`${webId} attempts creation of private resource <${resource}> without access token.\n`);

  const noTokenResponse = await fetch(resource, request);

  const wwwAuthenticateHeader = noTokenResponse.headers.get("WWW-Authenticate")!

  console.log(`= Status: ${noTokenResponse.status}\n`);
  console.log(`= Www-Authenticate header: ${wwwAuthenticateHeader}\n`);
  console.log('');

  const { as_uri, ticket } = Object.fromEntries(wwwAuthenticateHeader.replace(/^UMA /,'').split(', ').map(
      param => param.split('=').map(s => s.replace(/"/g,''))
  ));
  
  const tokenEndpoint = as_uri + "/token" // should normally be retrieved from .well-known/uma2-configuration

  // adding request ticket
  as_request_content.ticket = ticket;


  console.log(`=== Requesting token at ${tokenEndpoint} with ticket body:\n`);
  console.log(as_request_content);
  console.log('');

  const asRequestResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "content-type":"application/json"
      },
      body: JSON.stringify(as_request_content),
  })

  // For debugging:
  // console.log("Authorization Server response:", await asRequestResponse.text());
  // throw 'stop'

  const asResponse = await asRequestResponse.json()

  console.log("Authorization server response:", JSON.stringify(asResponse, null, 2))

  const decodedToken = parseJwt(asResponse.access_token);

  console.log(`= Status: ${asRequestResponse.status}\n`);
  console.log(`= Body (decoded):\n`);
  console.log({ ...asResponse, access_token: asResponse.access_token.slice(0,10).concat('...') });
  console.log('\n');

  // for (const permission of decodedToken.permissions) {
  //   console.log(`Permissioned scopes for resource ${permission.resource_id}:`, permission.resource_scopes)
  // }

  console.log(`=== Trying to create private resource <${resource}> WITH access token.\n`);  
  
  request.headers = { 'Authorization': `${asResponse.token_type} ${asResponse.access_token}` };

  const tokenResponse = await fetch(resource, request);

  console.log(`= Status: ${tokenResponse.status}\n`); 
}


async function authenticatedGet(resource: string, requesterWebId: string, as_request_content: any) {

  const request: RequestInit = { 
    method: "GET", 
    headers: {},
  };

  console.log('\n\n');

  console.log(`${requesterWebId} attempts creation of private resource <${resource}> without access token.\n`);

  const noTokenResponse = await fetch(resource, request);

  const wwwAuthenticateHeader = noTokenResponse.headers.get("WWW-Authenticate")!

  console.log(`= Status: ${noTokenResponse.status}\n`);
  console.log(`= Www-Authenticate header: ${wwwAuthenticateHeader}\n`);
  console.log('');

  const { as_uri, ticket } = Object.fromEntries(wwwAuthenticateHeader.replace(/^UMA /,'').split(', ').map(
      param => param.split('=').map(s => s.replace(/"/g,''))
  ));
  
  const tokenEndpoint = as_uri + "/token" // should normally be retrieved from .well-known/uma2-configuration

  // adding request ticket
  as_request_content.ticket = ticket;

  console.log(`=== Requesting token at ${tokenEndpoint} with ticket body:\n`);
  console.log(as_request_content);
  console.log('');

  const asRequestResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "content-type":"application/json"
      },
      body: JSON.stringify(as_request_content),
  })

  // For debugging:
  // console.log("Authorization Server response:", await asRequestResponse.text());
  // throw 'stop'

  const asResponse = await asRequestResponse.json()

  console.log("Authorization server response:", JSON.stringify(asResponse, null, 2))

  const decodedToken = parseJwt(asResponse.access_token);

  console.log(`= Status: ${asRequestResponse.status}\n`);
  console.log(`= Body (decoded):\n`);
  console.log({ ...asResponse, access_token: asResponse.access_token.slice(0,10).concat('...') });
  console.log('\n');

  // for (const permission of decodedToken.permissions) {
  //   console.log(`Permissioned scopes for resource ${permission.resource_id}:`, permission.resource_scopes)
  // }

  console.log(`=== Trying to create private resource <${resource}> WITH access token.\n`);  
  
  request.headers = { 'Authorization': `${asResponse.token_type} ${asResponse.access_token}` };

  const tokenResponse = await fetch(resource, request);
  const resourceContents = await tokenResponse.text();

  console.log(`= Resource contents: ${resourceContents}\n`); 
}

main();





// const content = {
//   '@context': [
//     'http://www.w3.org/ns/odrl/2/', 
//     'http://purl.org/dc/terms/',
//     'https://w3id.org/oac#',
//     'https://w3id.org/dpv/legal/eu/gdpr#',
//     'http://example.org/ns/UMA/'
//   ],
//   '@type': 'Request',
//   profile: { '@id': 'oac' },
//   uid: `http://example.org/HCPX-request/${randomUUID()}`,
//   description: `${webid} requests to read Alice's health data for bariatric care.`,
//   permission: {
//       '@type': 'Permission',
//       '@id': `http://example.org/HCPX-request-permission/${randomUUID()}`,
//       assigner: targetWebID,
//       assignee: webid,
//       target: resource,
//       action: { '@id': 'read' },
//       constraint: [{
//         leftOperand: { '@id': 'purpose' },
//         operator: { '@id': 'eq' },
//         rightOperand: { '@id': 'http://example.org/ns/healthcareontology/bariatric-care' },
//       }, {
//         leftOperand: { '@id': 'LegalBasis' },
//         operator: { '@id': 'eq' },
//         rightOperand: { '@id': 'A9-2-a' },
//       }],
//   },
//   // claims: [{
//     claim_token: encodeURIComponent(webid),
//     claim_token_format: 'urn:solidlab:uma:claims:formats:webid',
//   // }],
//   grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
//   ticket,
// };