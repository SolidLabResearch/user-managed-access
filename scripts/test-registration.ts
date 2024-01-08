import { fetch } from 'cross-fetch'

const resource = "http://localhost:3000/alice/public/resource.txt"

async function main() {

  console.log("=== Creating resource ...")

  const createResponse = await fetch(resource, {
    method: "PUT",
    body: "This is a resource."
  })

  console.log(`= Status: ${createResponse.status}`);

  console.log("=== Creating resource ...")

  const readResponse = await fetch(resource, {
    method: "GET",
  })

  console.log(`= Status: ${readResponse.status}`);
  console.log(`= Body: \n${await readResponse.text()}`);

  console.log("=== Deleting resource ...")


  const deleteResponse = await fetch(resource, {
    method: "DELETE",
  })

  console.log(`= Status: ${deleteResponse.status}`);

}

main();