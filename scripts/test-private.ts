import { fetch } from 'cross-fetch'

const privateResource = "http://localhost:3000/alice/private/resource.txt"

function parseJwt (token:string) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

const request: RequestInit = { 
  method: "PUT", 
  headers: {},
  body: 'Some text ...' ,
};

async function main() {

  console.log(`3.1 Send request to protected resource (${privateResource}) without access token.`);
  // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.1
  // 3.1 Client Requests Resource Without Providing an Access Token
  const noTokenResponse = await fetch(privateResource, request);

  console.log("3.2 Resource Server Responds to Client's Tokenless Access Attempt");
  // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.2
  // 3.2 Resource Server Responds to Client's Tokenless Access Attempt
  console.log(noTokenResponse.status);
  console.log(await noTokenResponse.text());
  const wwwAuthenticateHeader = noTokenResponse.headers.get("WWW-Authenticate")!
  // Note: needs errorhandling when not present
  console.log(wwwAuthenticateHeader);

  const { as_uri, ticket } = Object.fromEntries(wwwAuthenticateHeader.replace(/^UMA /,'').split(', ').map(
      param => param.split('=').map(s => s.replace(/"/g,''))
  ));
  console.log(as_uri);
  console.log(ticket);
  
  const tokenEndpoint = as_uri + "/token" // should normally be retrieved from .well-known/uma2-configuration

  // the claim that I am that person?
  // const claim_token = "http://localhost:3000/alice/profile/card#me"
  const claim_token = "https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me"

  console.log(`3.3.1 Client Request to Authorization Server (${as_uri}) for RPT`);
  // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.3.1
  // 3.3.1 Client Request to Authorization Server for RPT
  const body = JSON.stringify({
    grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
    ticket,
    claim_token: encodeURIComponent(claim_token),
    claim_token_format: 'urn:solidlab:uma:claims:formats:webid',
  });
  console.log("Token request body: ", body);
  const asRequestResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "content-type":"application/json"
      },
      body
  })

  // console.log("Authorization Server response:", await asRequestResponse.text());
  // throw 'stop'
  const asResponse = await asRequestResponse.json()
  console.log("Authorization Server response:", asResponse);

  console.log(`3.3.5 Authorization Server Response to Client on Authorization Success:`);
  // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.3.5 or https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.3.6
  // 3.3.5 or 3.3.6 Authorization Server Response to Client on Authorization Success or Failure
  // Note: it is required to have a debug uma server loaded

  const decodedToken = parseJwt(asResponse.access_token);

  console.log("Access token decoded:",decodedToken)
  console.log("Permissioned scopes:", decodedToken.permissions[0].resource_scopes)
  
  console.log(`3.4 Client Requests Resource and Provides an RPT`);
  // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.4
  // 3.4 Client Requests Resource and Provides an RPT
  // Only in happy flow (when we get a success 3.3.5)
  request.headers = { 'Authorization': `${asResponse.token_type} ${asResponse.access_token}` };
  const tokenResponse = await fetch(privateResource, request);

  console.log(`3.5 Resource Server Responds to Client's RPT-Accompanied Resource Request:`); 
  // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.3.5
  // 3.5 Resource Server Responds to Client's RPT-Accompanied Resource Request
  console.log(tokenResponse.status);
}
main()