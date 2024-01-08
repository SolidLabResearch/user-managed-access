import { fetch } from 'cross-fetch'

const container = "http://localhost:3000/alice/public/"
const slug = "resource.txt"

async function main() {

  console.log("=== Creating container (if needed) ...")

  const containerResponse = await fetch(container, {
    method: "PUT",
  })

  console.log(`= Status: ${containerResponse.status}`);

  console.log("=== Creating resource ...")

  const createResponse = await fetch(container, {
    method: "POST",
    headers: { slug },
    body: "This is a resource."
  })

  console.log(`= Status: ${createResponse.status}`);

  console.log("=== Creating resource ...")

  const readResponse = await fetch(container + slug, {
    method: "GET",
  })

  console.log(`= Status: ${readResponse.status}`);
  console.log(`= Body: \n${await readResponse.text()}`);

  console.log("=== Deleting resource ...")


  const deleteResponse = await fetch(container + slug, {
    method: "DELETE",
  })

  console.log(`= Status: ${deleteResponse.status}`);

}

main();