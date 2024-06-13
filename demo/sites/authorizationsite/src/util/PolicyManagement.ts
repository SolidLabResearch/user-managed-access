/* eslint-disable max-len */

import { Parser, Writer, Store, DataFactory } from 'n3';
import { demoPolicy } from "./policyCreation";
import { initContainer, log } from '../util/util';
import { InstantiatedPolicy, SimplePolicy } from './Types';
import rdfParser from "rdf-parse";
import { storeStream } from "rdf-store-stream";
import { ReadableWebToNodeStream } from "@smessie/readable-web-to-node-stream"


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

export const terms = {
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
    "age-credential": 'http://localhost:3000/ruben/credentials/age-credential',
  },
  agents: {
    ruben: 'http://localhost:3000/ruben/profile/card#me',
    vendor: 'http://localhost:5123/id',
    present: 'http://localhost:3000/demo/public/bday-app',
  },
  scopes: {
    read: 'urn:example:css:modes:read',
  }
}

export async function readInstantiationDirectory () {

  const policyContainer = 'http://localhost:3000/ruben/settings/policies/instantiated/';
  const mapping = async (uri: string) => {
    const response = await fetch(uri);
    const {text, stream} = await getResponseTextAndRDFStream(response, uri)
    console.log(1, stream, text)
    const store = await storeStream(stream) as Store;
    console.log(2, store)
    const policy : InstantiatedPolicy = await readPolicy(store, text)
    console.log(3, policy)
    if (store) {
      policy["prov:wasDerivedFrom"] = store.getQuads(null, 
        DataFactory.namedNode('http://www.w3.org/ns/prov#wasDerivedFrom')
        , null,  null).map(q => q.object.value)
    }
    return policy
  }
  return readDirectory<InstantiatedPolicy>(policyContainer, mapping);
}


export async function readPolicyDirectory () {

  // const policyContainer = 'http://localhost:3000/ruben/settings/policies/generic/';
  // const mapping = async (uri: string) => {
  //   const response = await fetch(uri);
  //   const {text, stream} = await getResponseTextAndRDFStream(response, uri)
  //   const store = await storeStream(stream) as Store;
  //   const policy = await readPolicy(store, text)
  //   return policy
  // }
  // return (await (readDirectory<SimplePolicy>(policyContainer, mapping))).concat(await loadMockPolicies());
  return (await loadMockPolicies());
}

export async function readDirectory<T>(container: string, mapping: (uri:string) => Promise<T|null>): Promise<T[]> {

  // create container if it does not exist yet
  await initContainer(container)

  const policyCreationResponse = await fetch(container);
  const responseText = await policyCreationResponse.text()

  const parsed = new Parser({baseIRI: container}).parse(responseText)
  const store = new Store()
  store.addQuads(parsed)

  let resourceQuads = store.getQuads(container, 'http://www.w3.org/ns/ldp#contains', null, null)
  let resourceURIs = resourceQuads.map(q => q.object.value)

  let objects = await Promise.all(resourceURIs.map(mapping))
  objects = objects.filter(e => e !== null)
  return (objects as T[] || []) 

}

export async function readPolicy(store: Store, text: string) {
  let policyIRI = store.getQuads(null, 
    DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), 
    DataFactory.namedNode('http://www.w3.org/ns/odrl/2/Agreement'),
    null)[0]?.subject.value
  if(!policyIRI) policyIRI = store.getQuads(null, 
    DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), 
    DataFactory.namedNode('http://www.w3.org/ns/odrl/2/Offer'),
    null)[0]?.subject.value
  const ruleIRI = store.getQuads(null, 
    DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), 
    DataFactory.namedNode('http://www.w3.org/ns/odrl/2/Permission')
    , null)[0]?.subject.value
  let description = store.getQuads(null, 
    DataFactory.namedNode('http://purl.org/dc/terms/description'), 
    null, null)[0]?.object.value
  if(!description) description = store.getQuads(null, 
    DataFactory.namedNode('http://purl.org/dc/elements/1.1/description'), 
    null, null)[0]?.object.value

    
  let simplePolicy: SimplePolicy = {
    representation: store,
    policyIRI,
    ruleIRIs: [ruleIRI],
    policyText: text,
    description,
  }

  return simplePolicy
}

export async function createAndSubmitPolicy(formdata: PolicyFormData) {

  const policyContainer = 'http://localhost:3000/ruben/settings/policies/generic/';

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

  const policyContainer = 'http://localhost:3000/ruben/settings/policies/generic/';

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

export async function getResponseTextAndRDFStream(response: Response, uri: string) {
  const response2 = response.clone()
  const resourceText = await response.text()
  let contentType = response.headers.get("content-type")
  if (!contentType) contentType = 'text/turtle' // fallback
  const readableWebStream = response2.body;
  if(!readableWebStream) throw new Error();
  const bodyStream = new ReadableWebToNodeStream(readableWebStream);
  const quadStream = rdfParser.parse(bodyStream, {
    contentType,
    baseIRI: uri
  })
  return {text: resourceText, stream: quadStream}
}

async function loadMockPolicies() {

  const uri1 = 'http://localhost:3000/ruben/settings/policies/generic/age-policy.jsonld'
  const response1 = await fetch('./policies/owner-can-read.jsonld', {
    headers : { 
      'Content-Type': 'application/ld+json',
      'Accept': 'application/ld+json'
    }
  }) 
  const {text: text1, stream: stream1} = await getResponseTextAndRDFStream(response1, uri1)
  const store1 = await storeStream(stream1) as Store;
  const policy1 = await readPolicy(store1, text1)
  policy1.isSystemPolicy = true;

  const uri2 = 'http://localhost:3000/ruben/settings/policies/generic/age-policy.jsonld'
  const response2 = await fetch('./policies/age-policy.jsonld', {
    headers : { 
      'Content-Type': 'application/ld+json',
      'Accept': 'application/ld+json'
    }
  }) 
  const {text: text2, stream: stream2} = await getResponseTextAndRDFStream(response2, uri2)
  const store2 = await storeStream(stream2) as Store;
  const policy2 = await readPolicy(store2, text2)

  return [ policy1, policy2 ] as SimplePolicy[]
}