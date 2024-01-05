import { fetch } from 'cross-fetch'

async function getToken(resource: string, method: string): Promise<{ token_type: string, access_token: string }> {
  const noTokenResponse = await fetch(resource, { method });
  const wwwAuthenticateHeader = noTokenResponse.headers.get("WWW-Authenticate")!;
  const { as_uri, ticket } = Object.fromEntries(wwwAuthenticateHeader.replace(/^UMA /,'').split(', ').map(
      param => param.split('=').map(s => s.replace(/"/g,''))
  ));
  const claim_token = "https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me";
  const tokenEndpoint = as_uri + "/token";
  const asRequestResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type":"application/x-www-form-urlencoded" },
    body: 
      `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Auma-ticket&ticket=${ticket}&claim_token=${encodeURIComponent(encodeURIComponent(claim_token))}&claim_token_format=${encodeURIComponent("urn:authorization-agent:dummy-token")}`
  })
  const asResponse = await asRequestResponse.json();
  return asResponse;
}

const resource = "http://localhost:3000/alice/resource.txt"

async function main() {

  const createToken = await getToken(resource, "PUT");

  console.log("### Creating resource ...")

  const createResponse = await fetch(resource, {
    method: "PUT",
    headers: { 'Authorization': `${createToken.token_type} ${createToken.access_token}` },
    body: "This is a resource."
  })

  console.log(await createResponse.status);

  const readToken = await getToken(resource, "GET");

  console.log("### Creating resource ...")

  const readResponse = await fetch(resource, {
    method: "GET",
    headers: { 'Authorization': `${readToken.token_type} ${readToken.access_token}` }
  })

  console.log(await readResponse.text());

  console.log("### Deleting resource ...")

  const deleteToken = await getToken(resource, "DELETE");

  const deleteResponse = await fetch(resource, {
    method: "DELETE",
    headers: { 'Authorization': `${deleteToken.token_type} ${deleteToken.access_token}` },
  })

  console.log(await deleteResponse.text());

}

main();