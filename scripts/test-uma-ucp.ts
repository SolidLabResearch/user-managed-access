import { fetch } from 'cross-fetch'

// Resource and WebID as set in config/rules/policy/policy0.ttl
const resource = "http://localhost:3000/alice/other/resource.txt";
const webid = "https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me";

function parseJwt (token:string) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

const request: RequestInit = { 
  method: "PUT", 
  headers: {},
  body: 'Some text ...' ,
};

async function main() {

  console.log('\n\n');

  console.log(`=== Trying to create private resource <${resource}> without access token.\n`);

  const noTokenResponse = await fetch(resource, request);

  const wwwAuthenticateHeader = noTokenResponse.headers.get("WWW-Authenticate")!

  console.log(`= Status: ${noTokenResponse.status}\n`);
  console.log(`= Www-Authenticate header: ${wwwAuthenticateHeader}\n`);
  console.log('');

  const { as_uri, ticket } = Object.fromEntries(wwwAuthenticateHeader.replace(/^UMA /,'').split(', ').map(
      param => param.split('=').map(s => s.replace(/"/g,''))
  ));
  
  const tokenEndpoint = as_uri + "/token" // should normally be retrieved from .well-known/uma2-configuration

  const content = {
    grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
    ticket,
    claim_token: encodeURIComponent(webid),
    claim_token_format: 'urn:solidlab:uma:claims:formats:webid',
  };

  console.log(`=== Requesting token at ${tokenEndpoint} with ticket body:\n`);
  console.log(content);
  console.log('');

  const asRequestResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "content-type":"application/json"
      },
      body: JSON.stringify(content),
  })

  // For debugging:
  // console.log("Authorization Server response:", await asRequestResponse.text());
  // throw 'stop'

  const asResponse = await asRequestResponse.json()

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

main();
