/* eslint-disable max-len */
import { Parser, Writer, Store, Quad } from 'n3'
import sign from 'jwt-encode'

import rdfParser from 'rdf-parse'
import rdfSerializer from 'rdf-serialize'
import Streamify from 'streamify-string'

import { decodeJwt, createRemoteJWKSet, jwtVerify } from "jose";

const UMA_DISCOVERY = '/.well-known/uma2-configuration';

const REQUIRED_METADATA = [
  'issuer', 
  'jwks_uri', 
  'permission_endpoint', 
  'introspection_endpoint', 
  'resource_registration_endpoint'
];

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

async function getUmaServerForWebID(webId: string) {
  let profileText;
  let webIdData: Store;
  try {
    profileText = await (await fetch(webId, {headers: { "accept": 'text-turtle'}})).text()
    webIdData = new Store(parser.parse(profileText));
  } catch (e: any) {
    log(e)
    throw new Error('Could not read WebID information')
  }
  return webIdData.getObjects(webId, terms.solid.umaServer, null)[0]?.value;
}


export async function retrieveData(documentURI: string, webId: string): Promise<{ data: string, token?: any }> {

  const policyContainer = 'http://localhost:3000/ruben/settings/policies/generic/';

  log(`Access to Ruben's data is based on policies he manages through his Authz Companion app, and which are stored in <${policyContainer}>. (This is, of course, not publicly known.)`);

  const umaServer = await getUmaServerForWebID(webId)
  
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
        "urn:solidlab:uma:claims:types:webid": "http://localhost:5123/id"
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

  // Retrieving document with access token

  const accessWithTokenResponse = await fetch(documentURI, {
    headers: { 'Authorization': `${tokenParams.token_type} ${tokenParams.access_token}` }
  });

  if (accessWithTokenResponse.status !== 200) { log('Access with token failed...'); throw new Error("Access with token failed..."); }

  log(`The agent can then use this access token at the Resource Server to perform the desired action.`);

  let result = await accessWithTokenResponse.text()
  
  return { data: result, token: tokenParams.access_token }
}

export async function processAgeResult(data: string, webId: string): Promise<boolean> {

  // .default because of some typing errors 
  const parsedQuads: Quad[] = await new Promise((resolve, reject) => {
    let quads: Quad[] = []
    const textStream = Streamify(data);
    let quadStream = rdfParser.parse(textStream, { contentType: 'application/ld+json' }); // todo: dynamic checking
    quadStream
      .on('data', (quad: any) => quads.push(quad))
      .on('error', (error: any) => console.error(error))
      .on('end', () => resolve(quads));

  })

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

function isString(value: any): value is string {
  return typeof value === 'string' || value instanceof String;
}

function log(msg: string, obj?: any) {
  console.log('');
  console.log(msg);
  if (obj) {
    console.log('\n');
    console.log(obj);
  }
}


/**
 * Token verification and contract extraction
 */

 /**
   * Fetch UMA Configuration of AS
   * @param {string} issuer - Base URL of the UMA AS
   * @return {Promise<UmaConfig>} - UMA Configuration
   */
 async function fetchUmaConfig(issuer: string): Promise<any> {
  const configUrl = issuer + UMA_DISCOVERY;
  const res = await fetch(configUrl);

  if (res.status >= 400) {
    throw new Error(`Unable to retrieve UMA Configuration for Authorization Server '${issuer}' from '${configUrl}'`);
  }

  const configuration = await res.json();

  const missing = REQUIRED_METADATA.filter((value) => !(value in configuration));
  if (missing.length !== 0) {
    throw new Error(`The Authorization Server Metadata of '${issuer}' is missing attributes ${missing.join(', ')}`);
  }

  const noString = REQUIRED_METADATA.filter((value) => !isString(configuration[value]));
  if (noString.length !== 0) throw new Error(
    `The Authorization Server Metadata of '${issuer}' should have string attributes ${noString.join(', ')}`
  );

  return configuration;
}


async function verifyTokenData(token: string, issuer: string, jwks: string): Promise<any> {
  const jwkSet = await createRemoteJWKSet(new URL(jwks));

  const { payload } = await jwtVerify(token, jwkSet, {
    issuer: issuer,
    audience: 'solid',
  });

  return payload
}

/**
 * Validates & parses JWT access token
 * @param {string} token - the JWT access token
 * @return {UmaToken}
 */
export async function verifyJwtToken(token: string, webId: string) {
  let config;
  let decoded;
  try {
    decoded = decodeJwt(token)
    const issuer = decoded.iss;
    if (!issuer) 
      throw new Error('The JWT does not contain an "iss" parameter.');

    let umaServer = await getUmaServerForWebID(webId)
    const umaServerToCheck = umaServer.endsWith('/') ? umaServer : umaServer + '/'
    const issuerToCheck = issuer.endsWith('/') ? issuer : issuer + '/'
    // todo: Make sure that the uma server URL is consistent everywhere in ending with a '/' or not! 
    if ( umaServerToCheck !== issuerToCheck ) 
      throw new Error(`The JWT wasn't issued by one of the target owners' issuers.`);

    config = await fetchUmaConfig(issuer);
  } catch (error: unknown) {
    const message = `Error verifying UMA access token: ${(error as Error).message}`;
    console.warn(message);
    throw new Error(message);
  }

  return ( await verifyTokenData(token, config.issuer, config.jwks_uri) ) ;
}

// MOVE THIS SHIT TO AN AUDITING INTERFACE

export async function extractContractFromToken(token: string, webId: string) {
  try {
    const payload = await verifyJwtToken(token, webId)
    const contract = payload.contract;
    return { contract, verified: true}
  } catch (_ignored) {
    const payload = decodeJwt(token)
    const contract = payload.contract;
    return { contract, verified: false}
  }
}


type VCVerificationResult = {
  validationResult: {
    valid: boolean
  }
  verificationResult: {
    verified: boolean
  }
}

export async function verifyVCsignature(verificationUrl: string, data: string): Promise<VCVerificationResult> {
  
  const res = await fetch(verificationUrl, {
    method: "POST",
    body: data,
    headers: { "Content-Type": "application/json" }
  })
  
  const {validationResult, verificationResult} = (await res.json()) as VCVerificationResult

  console.log('[store-backend] validationResult', validationResult)
  console.log('[store-backend] verificationResult', verificationResult)

  return {validationResult, verificationResult}

}