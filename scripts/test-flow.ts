import { fetch } from 'cross-fetch'

const privateResource = "http://localhost:3000/alice/profile/test.ttl"

function parseJwt (token:string) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

async function main() {

  console.log(`3.1 Send request to protected resource (${privateResource}) without access token.`);
  // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.1
  // 3.1 Client Requests Resource Without Providing an Access Token
  const noTokenResponse = await fetch(privateResource, { method: "GET" });
  console.log(noTokenResponse.status);
  console.log(await noTokenResponse.text());

  console.log("3.2 Resource Server Responds to Client's Tokenless Access Attempt");
  // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.2
  // 3.2 Resource Server Responds to Client's Tokenless Access Attempt
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
  const asRequestResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
          "content-type":"application/x-www-form-urlencoded"
      },
      body: 
          `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Auma-ticket&ticket=${ticket}&claim_token=${encodeURIComponent(encodeURIComponent(claim_token))}&claim_token_format=${encodeURIComponent("urn:authorization-agent:dummy-token")}`
  })

  const asResponse = await asRequestResponse.json()
  console.log("Authorization Server response:", asResponse);

  console.log(`3.3.5 Authorization Server Response to Client on Authorization Success:`);
  // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.3.5 or https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.3.6
  // 3.3.5 or 3.3.6 Authorization Server Response to Client on Authorization Success or Failure
  // Note: it is required to have a debug uma server loaded

  const decodedToken = parseJwt(asResponse.access_token);

  console.log("Access token decoded:",decodedToken)
  console.log("Permissioned scopes:", decodedToken.permissions[0].resource_scopes)
  
  /* error message example
  {
  status: 403,
  description: 'Forbidden',
  error: 'request_denied',
  message: 'Unable to authorize request.'
  }
  */

  /* Succes message example
  {
  access_token: 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjFlYmE3M2JkLTg5NzYtNDNmMy04NDM3LTRiN2RmOThiNjY1YSJ9.eyJ3ZWJpZCI6Imh0dHBzOi8vd29zbGFiYmkucG9kLmtub3dzLmlkbGFiLnVnZW50LmJlL3Byb2ZpbGUvY2FyZCNtZSIsImF6cCI6Imh0dHA6Ly93d3cudzMub3JnL25zL2F1dGgvYWNsI09yaWdpbiIsIm1vZGVzIjpbImh0dHA6Ly93d3cudzMub3JnL25zL2F1dGgvYWNsI1JlYWQiXSwic3ViIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL2FsaWNlL3Byb2ZpbGUvIiwiaWF0IjoxNjkyNzkwOTg2LCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQwMDAvdW1hIiwiYXVkIjoic29saWQiLCJleHAiOjE2OTI3OTEyODYsImp0aSI6IjEwOGRlOGUzLTI0YjMtNDBlNS1hOWM4LWVjZjc5NDc1NDMwYiJ9.Qt6R8jh1L-f8txy8Vph3DYwV3y2wcemrmnEuagXLLg1RsMDBXY-1uSCsrYMzlxxslgWj_Z2_Fyy7Y8z1-Z_Pkg',
  token_type: 'Bearer'
  }
  */
  console.log(`3.4 Client Requests Resource and Provides an RPT`);
  // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.4
  // 3.4 Client Requests Resource and Provides an RPT
  // Only in happy flow (when we get a success 3.3.5)
  const tokenResponse = await fetch(privateResource, {
      method: "GET",
      headers: {
          Authorization: `${asResponse.token_type} ${asResponse.access_token}`
      }
  })

  console.log(`3.5 Resource Server Responds to Client's RPT-Accompanied Resource Request:`); 
  // https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html#rfc.section.3.3.5
  // 3.5 Resource Server Responds to Client's RPT-Accompanied Resource Request
  console.log(await tokenResponse.text());
}
main()