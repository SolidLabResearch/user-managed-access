import { fetch } from 'cross-fetch'

const publicResource = "http://localhost:3000/alice/profile/card"

async function main() {
  console.log(`=== Trying to read public resource <${publicResource}> without access token.`);
  
  const publicResponse = await fetch(publicResource, { method: "GET" });
  
  console.log(`= Status: ${publicResponse.status}`);
  console.log(`= Body: \n${await publicResponse.text()}`);
}

main();