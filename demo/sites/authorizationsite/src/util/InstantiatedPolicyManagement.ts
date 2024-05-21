/* eslint-disable max-len */

import { Parser, Writer, Store, DataFactory } from 'n3';
import { demoPolicy } from "./policyCreation";
import { SimplePolicy } from './Types';
import { initContainer, log } from './util';

export type PolicyFormData = {
  target: string,
  assignee: string, 
  startDate: Date,
  endDate: Date,
  purpose: string,
  description: string,
}

const parser = new Parser();
const writer = new Writer();


export async function readPolicyDirectory () {
  const policyContainer = 'http://localhost:3000/ruben/settings/policies/generic/';

  // create container if it does not exist yet
  await initContainer(policyContainer)

  const policyCreationResponse = await fetch(policyContainer);
  const responseText = await policyCreationResponse.text()

  const parsed = new Parser({baseIRI: policyContainer}).parse(responseText)
  const store = new Store()
  store.addQuads(parsed)

  let resourceQuads = store.getQuads(policyContainer, 'http://www.w3.org/ns/ldp#contains', null, null)
  let resourceURIs = resourceQuads.map(q => q.object.value)

  let policyObjects = await Promise.all(resourceURIs.map(async (location) => {
    const resource = await fetch(location);
    const resourceText = await resource.text()
    const policy = await readPolicy(resourceText)
    return policy
  }))
  policyObjects = policyObjects.filter(e => e !== null)
  return (policyObjects || []) as SimplePolicy[]
}

export async function readPolicy(policyText: string) {
  if (policyText === '') return null;
  const parsed = await new Parser().parse(policyText)
  const store = new Store()
  store.addQuads(parsed)
  const policyIRI = store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/ns/odrl/2/Agreement', null)[0]?.subject.value
  const ruleIRI = store.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/ns/odrl/2/Permission', null)[0]?.subject.value
  const description = store.getQuads(null, 'http://purl.org/dc/terms/description', null, null)[0]?.object.value
  let simplePolicy: SimplePolicy = {
    representation: store,
    policyIRI,
    ruleIRIs: [ruleIRI],
    policyText: policyText,
    description,
  }

  return simplePolicy
}

export async function createAndSubmitPolicy(formdata: PolicyFormData) {
  console.log('Creating policy')

  const policyContainer = 'http://localhost:3000/ruben/settings/policies/';

  const policy = demoPolicy(formdata.target, formdata.assignee, 
    { startDate: formdata.startDate, endDate: formdata.endDate, purpose: formdata.purpose })
    
  const descriptionQuad = DataFactory.quad(
    DataFactory.namedNode(policy.policyIRI), 
    DataFactory.namedNode('http://purl.org/dc/terms/description'),
    DataFactory.literal(formdata.description)
  )
  const policyString = writer.quadsToString(policy.representation.getQuads(null, null, null, null).concat(descriptionQuad))

  // create container if it does not exist yet
  await initContainer(policyContainer)
  const policyCreationResponse = await fetch(policyContainer, {
    method: 'POST',
    headers: { 'content-type': 'text/turtle' },
    body: policyString
  });

  if (policyCreationResponse.status !== 201) { log('Adding a policy did not succeed...'); throw 0; }
  
  log(`Now that the policy has been set, and the agent has possibly been notified in some way, the agent can try the access request again.`);
  policy.policyText = policyString
  return policy
  
}

export async function doPolicyFlowFromString(policyText: string) {
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
