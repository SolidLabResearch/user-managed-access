/* eslint-disable max-len */
import { Parser, Writer, Store, Quad } from 'n3'
import sign from 'jwt-encode'

import rdfParser from 'rdf-parse'
import rdfSerializer from 'rdf-serialize'
import Streamify from 'streamify-string'

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
    "age-credential": 'http://localhost:3000/ruben/private/age-credential',
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



export async function retrieveData(documentURI: string, webId: string): Promise<string> {
  
  let profileText, viewIndex, views;
  let webIdData: Store;

  try {
    profileText = await (await fetch(webId, {headers: { "accept": 'text-turtle'}})).text()
    webIdData = new Store(parser.parse(profileText));
  } catch (e: any) {
    log(e)
    throw new Error('Could not read WebID information')
  }

  if (webIdData && webIdData.getQuads(null, "http://xmlns.com/foaf/0.1/age", null, null).length) {
    // Valid age found, we can return the profile document
    return profileText

  }

  const policyContainer = 'http://localhost:3000/ruben/settings/policies/generic/';

  log(`Access to Ruben's data is based on policies he manages through his Authz Companion app, and which are stored in <${policyContainer}>. (This is, of course, not publicly known.)`);

  const umaServer = webIdData.getObjects(webId, terms.solid.umaServer, null)[0]?.value;
  
  if (!umaServer) throw new Error('Could not request access to required data for verification'); 

  const configUrl = new URL('.well-known/uma2-configuration', umaServer);
  const umaConfig: any = await (await fetch(configUrl)).json();
  const tokenEndpoint: any = umaConfig.token_endpoint;

  log(`To request access to Ruben's data, an agent will need to negotiate with Ruben's Authorization Server, which his WebID document identifies as <${umaServer}>.`);
  log(`Via the Well-Known endpoint <${configUrl.href}>, we can discover the Token Endpoint <${tokenEndpoint}>.`);

  log(`Now, having discovered both the location of the UMA server and of the desired data, an agent can request the former for access to the latter.`);

  const accessRequest = {
    permissions: [{
      resource_id: documentURI,
      resource_scopes: [ terms.scopes.read ],
    }]
  };
  
  log(JSON.stringify(accessRequest))

  let tokenEndpointResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(accessRequest),
  });

  // log(JSON.stringify(await tokenEndpointResponse.text()))
  

  if (tokenEndpointResponse.status === 403) { 
    try {
      const { ticket, required_claims }: any = await tokenEndpointResponse.json();
      if (!ticket || !required_claims) { // There is no negotiation 
        throw new Error('Notification sent. Check your companion app.') 
      }

      log(`Based on the policy, the UMA server requests the following claims from the agent:`);
      required_claims.claim_token_format[0].forEach((format: string) => log(`  - ${format}`))

      const data = {
        "http://www.w3.org/ns/odrl/2/purpose": "urn:solidlab:uma:claims:purpose:age-verification",
        "urn:solidlab:uma:claims:types:webid": "http://localhost:3000/demo/public/vendor"
      }
      // todo: Have a store public key and use this to sign (though it's https is it really necessary?)
      const secret = ('store public key') // todo: this should be the public key
      
      const claim_token = sign(data, secret)

      log(`The agent gathers the necessary claims (the manner in which is out-of-scope for this demo), and sends them to the UMA server as a JWT.`)

      tokenEndpointResponse = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...accessRequest,
          ticket,
          claim_token_format: 'urn:solidlab:uma:claims:formats:jwt',
          claim_token,
        })
      });

    } catch(e) {
      log(`Without a policy allowing the access, the access is denied.`);
      log(`However, the UMA server enables multiple flows in which such a policy can be added, for example by notifying the resource owner. (This is out-of-scope for this demo.)`);
      throw e
    } 
  }

  if (tokenEndpointResponse.status !== 200) { log('Access request failed despite policy...'); throw new Error("Access request failed despite policy..."); }

  log(`The UMA server checks the claims with the relevant policy, and returns the agent an access token with the requested permissions.`);
  
  const tokenParams: any = await tokenEndpointResponse.json();
  const accessWithTokenResponse = await fetch(documentURI, {
    headers: { 'Authorization': `${tokenParams.token_type} ${tokenParams.access_token}` }
  });

  if (accessWithTokenResponse.status !== 200) { log('Access with token failed...'); throw new Error("Access with token failed..."); }

  log(`The agent can then use this access token at the Resource Server to perform the desired action.`);

  let result = await accessWithTokenResponse.text()

  console.log(`retrieved data\n${result}`)
  
  return result
}

export async function processAgeResult(data: string, webId: string): Promise<boolean> {
  console.log('processing age result', data, webId)



  // .default because of some typing errors 
  const parsedQuads: Quad[] = await new Promise((resolve, reject) => {
    let quads: Quad[] = []
    const textStream = Streamify(data);
    console.log('rdfParser', rdfParser)
    let quadStream = rdfParser.parse(textStream, { contentType: 'application/ld+json' }); // todo: dynamic checking
    quadStream
      .on('data', (quad: any) => quads.push(quad))
      .on('error', (error: any) => console.error(error))
      .on('end', () => resolve(quads));

  })

  console.log('quads', JSON.stringify(parsedQuads, null, 2))

  const store = new Store(parsedQuads)
  let age = store.getQuads(null, "http://www.w3.org/2006/vcard/ns#bday", null, null)[0]?.object.value // todo: non-mocked checking
  if (age && parseInt(age) >= 18) {
    console.log(`Discovered age value of ${parseInt(age)}, enabling all restricted content`)
    return true
  } else {
    console.log('Could not discover an appropriate age value for user, keeping restricted content disabled')
    return false
  }
}


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

