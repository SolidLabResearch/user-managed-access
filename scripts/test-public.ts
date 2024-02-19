import { fetch } from 'cross-fetch'

const publicResource = "http://localhost:3000/alice/profile/card"

async function main() {

  console.log('\n\n');

  console.log(`=== Trying to read public resource <${publicResource}> without access token.\n`);
  
  const publicResponse = await fetch(publicResource, { method: "GET" });

  console.log(`= Status: ${publicResponse.status}\n`);
  console.log(`= Body:\n \n${await publicResponse.text()}\n`);
}

main();
