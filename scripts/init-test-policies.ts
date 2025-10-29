import { Parser, Writer } from 'n3';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function main() {
  const owner = 'https://pod.woutslabbinck.com/profile/card#me';
  const url = `http://localhost:4000/uma/policies`;

  // Need to parse the file so we can set the base URL to that of the resource server
  const policyData = await readFile(join(__dirname, '../packages/uma/config/rules/policy/policy0.ttl'), 'utf8');
  const quads = new Parser({ baseIRI: `http://localhost:3000/` }).parse(policyData);
  const body = new Writer().quadsToString(quads);

  console.log(`=== Trying to initialize test policies.\n`);
  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization: owner, 'content-type': 'text/turtle' },
    body,
  });
  console.log(`= Status: ${response.status}\n`);
}

main();
