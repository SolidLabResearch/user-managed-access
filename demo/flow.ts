/* eslint-disable max-len */

import { fetch } from 'cross-fetch';
import { Parser, Writer, Store } from 'n3';
import { demoPolicy } from "./policyCreation";

const parser = new Parser();
const writer = new Writer();

const terms = {
  solid: {
    umaServer: 'http://www.w3.org/ns/solid/terms#umaServer',
    viewIndex: 'http://www.w3.org/ns/solid/terms#viewIndex',
    entry: 'http://www.w3.org/ns/solid/terms#entry',
    filter: 'http://www.w3.org/ns/solid/terms#filter',
    location: 'http://www.w3.org/ns/solid/terms#location',
  },
  filters: {
    bday: 'http://localhost:3000/catalog/public/filters/bday',
    age: 'http://localhost:3000/catalog/public/filters/age',
  },
  views: {
    bday: 'http://localhost:3000/ruben/private/derived/bday',
    age: 'http://localhost:3000/ruben/private/derived/age',
  },
  agents: {
    ruben: 'http://localhost:3000/ruben/profile/card#me',
    vendor: 'http://localhost:3000/demo/public/vendor',
    present: 'http://localhost:3000/demo/public/bday-app',
  },
  scopes: {
    read: 'urn:example:css:modes:read',
  }
}

async function main() {

  log(`Alright, so, for the demo ...`);

  log(`Ruben V., a.k.a. <${terms.agents.ruben}>, has some private data in <http://localhost:3000/ruben/private/data>.`);

  log(`Of course, he does not want everyone to be able to see all of his private data when they need just one aspect of it. Therefore, Ruben has installed two Views on his data, based on SPARQL filters from a public Catalog. (When and how this is done is out-of-scope for now.)`);

  const webIdData = new Store(parser.parse(await (await fetch(terms.agents.ruben)).text()));
  const viewIndex = webIdData.getObjects(terms.agents.ruben, terms.solid.viewIndex, null)[0].value;
  const views = Object.fromEntries(webIdData.getObjects(viewIndex, terms.solid.entry, null).map(entry => {
    const filter = webIdData.getObjects(entry, terms.solid.filter, null)[0].value;
    const location = webIdData.getObjects(entry, terms.solid.location, null)[0].value;
    return [filter, location];
  }));

  log(`Discovery of views is currently a very crude mechanism based on a public index in the WebID document. (A cleaner mechanism using the UMA server as central hub is being devised.) Using the discovery mechanism, we find the following views on Ruben's private data.`)

  log(`(1) <${views[terms.filters.bday]}> filters out his birth date, according to the <${terms.filters.bday}> filter`);
  log(`(2) <${views[terms.filters.age]}> derives his age, according to the <${terms.filters.bday}> filter`);

  const policyContainer = 'http://localhost:3000/ruben/settings/policies/';

  log(`Access to Ruben's data is based on policies he manages through his Authz Companion app, and which are stored in <${policyContainer}>. (This is, of course, not publicly known.)`);

  const umaServer = webIdData.getObjects(terms.agents.ruben, terms.solid.umaServer, null)[0].value;
  const configUrl = new URL('.well-known/uma2-configuration', umaServer);
  const umaConfig = await (await fetch(configUrl)).json();
  const tokenEndpoint = umaConfig.token_endpoint;

  log(`To request access to Ruben's data, an agent will need to negotiate with Ruben's Authorization Server, which his WebID document identifies as <${umaServer}>.`);
  log(`Via the Well-Known endpoint <${configUrl.href}>, we can discover the Token Endpoint <${tokenEndpoint}>.`);

  log(`Now, having discovered both the location of the UMA server and of the desired data, an agent can request the former for access to the latter.`);

  log(`...`);

  log(`Having been notified in some way of the access request, Ruben could go to his Authz Companion app, and add a policy allowing the requested access.`);

  const startDate = new Date();
  const endDate = new Date(startDate.valueOf() + 14 * 24 * 60 * 60 * 1000);
  const purpose = 'age-verification'
  const policy = demoPolicy(terms.views.age, terms.agents.vendor, { startDate, endDate, purpose })

  const policyCreationResponse = await fetch(policyContainer, {
    method: 'POST',
    headers: { 'content-type': 'text/turtle' },
    body: writer.quadsToString(policy.representation.getQuads(null, null, null, null))
  });

  if (policyCreationResponse.status !== 201) { log('Adding a policy did not succeed...'); throw 0; }

  log(`Now that the policy has been set, and the agent has possibly been notified in some way, the agent can try the access request again.`);

  const content = {
    // grant_type: 'urn:ietf:params:oauth:grant-type:uma-ticket',
    claim_token: encodeURIComponent(terms.agents.vendor),
    claim_token_format: 'urn:solidlab:uma:claims:formats:webid',
    // ticket,
    permissions: [{
      resource_id: terms.views.age,
      resource_scopes: [ terms.scopes.read ],
    }]
  };

  console.log(`=== Requesting token at ${tokenEndpoint} with ticket body:\n`);
  console.log(content);
  console.log('');

  const asRequestResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "content-type":"application/json" },
      body: JSON.stringify(content),
  })

  // For debugging:
  // console.log("Authorization Server response:", await asRequestResponse.text());
  // throw 'stop'

  const asResponse = await asRequestResponse.json();

  const decodedToken = parseJwt(asResponse.access_token);

  console.log(`= Status: ${asRequestResponse.status}\n`);
  console.log(`= Body (decoded):\n`);
  console.log({ ...asResponse, access_token: asResponse.access_token.slice(0,10).concat('...') });
  console.log('\n');

  for (const permission of decodedToken.permissions) {
    console.log(`Permissioned scopes for resource ${permission.resource_id}:`, permission.resource_scopes)
  }
  
  console.log(`=== Trying to create private resource <${terms.views.age}> WITH access token.\n`);
  
  const tokenResponse = await fetch(terms.views.age, {
    headers: { 'Authorization': `${asResponse.token_type} ${asResponse.access_token}` }
  });

  console.log(`= Status: ${tokenResponse.status}\n`); 
  console.log(`= Body:\n`); 
  console.log(`= Body: ${await tokenResponse.text()}`); 
  console.log(`\n`); 
}

main();


/* Helper functions */

function parseJwt (token:string) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

function log(msg: string, obj?: any) {
  console.log('');
  console.log(msg);
  if (obj) {
    console.log('\n');
    console.log(obj);
  }
}
