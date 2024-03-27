/* eslint-disable max-len */

import { Parser, Writer, Store } from 'n3';
import { SimplePolicy, demoPolicy } from "./policyCreation";

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

export async function readPolicyDirectory () {
  const policyContainer = 'http://localhost:3000/ruben/settings/policies/';

  // create container if it does not exist yet
  await initContainer(policyContainer)

  const policyCreationResponse = await fetch(policyContainer);
  const responseText = await policyCreationResponse.text()

  const parsed = new Parser({baseIRI: policyContainer}).parse(responseText)
  const store = new Store()
  store.addQuads(parsed)

  let resourceQuads = store.getQuads(policyContainer, 'http://www.w3.org/ns/ldp#contains', null, null)
  let resourceURIs = resourceQuads.map(q => q.object.value)

  console.log('IRIS', responseText, resourceURIs)
  const policyObjects = await Promise.all(resourceURIs.map(async (location) => {
    const resource = await fetch(location);
    const resourceText = await resource.text()
    const policy = await readPolicy(resourceText)
    return policy
  }))
  
  return policyObjects || []

}

async function readPolicy(policyText: string) {
  const parsed = await new Parser().parse(policyText)
  const store = new Store()
  store.addQuads(parsed)
  const policyIRI = store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/ns/odrl/2/Agreement', null)[0]?.subject.value
  const ruleIRI = store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/ns/odrl/2/Permission', null)[0]?.subject.value
  let simplePolicy: SimplePolicy = {
    representation: store,
    policyIRI,
    ruleIRIs: [ruleIRI]
  }

  return simplePolicy
}

export async function createPolicy(policyText: string) {
  console.log('Creating policy')

  const policyContainer = 'http://localhost:3000/ruben/settings/policies/';


  log(`Having been notified in some way of the access request, Ruben could go to his Authz Companion app, and add a policy allowing the requested access.`);

  const startDate = new Date();
  const endDate = new Date(startDate.valueOf() + 14 * 24 * 60 * 60 * 1000);
  const purpose = 'urn:solidlab:uma:claims:purpose:age-verification'
  const policy = demoPolicy(terms.views.age, terms.agents.vendor, { startDate, endDate, purpose })

  // create container if it does not exist yet
  await initContainer(policyContainer)
  const policyCreationResponse = await fetch(policyContainer, {
    method: 'POST',
    headers: { 'content-type': 'text/turtle' },
    body: writer.quadsToString(policy.representation.getQuads(null, null, null, null))
  });

  if (policyCreationResponse.status !== 201) { log('Adding a policy did not succeed...'); throw 0; }
  
  log(`Now that the policy has been set, and the agent has possibly been notified in some way, the agent can try the access request again.`);
  
}

export async function doPolicyFlowFromString(policyText: string) {
  console.log('Creating policy')

  const policyContainer = 'http://localhost:3000/ruben/settings/policies/';

  // create container if it does not exist yet
  await initContainer(policyContainer)
  const policyCreationResponse = await fetch(policyContainer, {
    method: 'POST',
    headers: { 'content-type': 'text/turtle' },
    body: policyText
  });

  if (policyCreationResponse.status !== 201) { log('Adding a policy did not succeed...'); throw 0; }
  
  log(`Now that the policy has been set, and the agent has possibly been notified in some way, the agent can try the access request again.`);
  
}


/* Helper functions */

function log(msg: string, obj?: any) {
  console.log('');
  console.log(msg);
  if (obj) {
    console.log('\n');
    console.log(obj);
  }
}

// creates the container if it does not exist yet (only when access is there)
async function initContainer(policyContainer: string): Promise<void> {
  const res = await fetch(policyContainer)
  if (res.status === 404) {
    const res = await fetch(policyContainer, {
      method: 'PUT'
    })
    if (res.status !== 201) {
      log('Creating container at ' + policyContainer + ' not successful'); throw 0;
    }
  }
}

