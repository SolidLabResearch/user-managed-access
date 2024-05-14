import { Parser, Store } from "n3";
import { initContainer } from "./util";
import { VerifiableCredential } from "./Types";

export async function readCredentialsDirectory(fetch: Function) {
    const container = 'http://localhost:3000/ruben/credentials/';

    // create container if it does not exist yet
    await initContainer(container)
  
    const containerContents = await fetch(container);
    const containerContentsRDF = await containerContents.text()
  
    const parsed = new Parser({baseIRI: container}).parse(containerContentsRDF)
    const store = new Store()
    store.addQuads(parsed)
  
    let resourceQuads = store.getQuads(container, 'http://www.w3.org/ns/ldp#contains', null, null)
    let resourceURIs = resourceQuads.map(q => q.object.value)
  
    let objects = await Promise.all(resourceURIs.map(async (location) => {
      const resource = await fetch(location);
      const resourceText = await resource.text()
      const credential = await readCredential(resourceText)
      if (credential) credential.location = location;
      return credential
    }))
    objects = objects.filter(e => e !== null)
    return (objects || []) as VerifiableCredential[]
}

function readCredential(text: string): VerifiableCredential | undefined {
  if (text === '') return;
  // We take advantage of the required JSON formatting of Verifiable Credentials
  const credential = JSON.parse(text) as VerifiableCredential;
  return credential;
}