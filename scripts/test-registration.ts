#!/usr/bin/env ts-node

const container = "http://localhost:3000/alice/public/";
const slug = "resource.txt";
const body = "This is a resource.";

async function main() {

  console.log(`=== PUT container <${container}>\n`);

  const containerResponse = await fetch(container, {
    method: "PUT",
  })

  console.log(`= Status: ${containerResponse.status}\n`);
  console.log('\n');

  console.log(`=== POST to <${container}> with slug '${slug}': "${body}"\n`)

  const createResponse = await fetch(container, {
    method: "POST",
    headers: { slug },
    body
  })

  console.log(`= Status: ${createResponse.status}\n`);
  console.log('\n');

  console.log(`=== GET <${container + slug}>\n`);

  const readResponse = await fetch(container + slug, {
    method: "GET",
  })

  console.log(`= Status: ${readResponse.status}\n`);
  console.log(`= Body: "${await readResponse.text()}"\n`);
  console.log('\n');

  console.log(`=== DELETE <${container + slug}>\n`);

  const deleteResponse = await fetch(container + slug, {
    method: "DELETE",
  })

  console.log(`= Status: ${deleteResponse.status}\n`);
}

main();
