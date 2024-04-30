import { AuditEntry } from "./Types";
import { Parser, Writer, Store, Quad } from 'n3'

import rdfParser from 'rdf-parse'
import Streamify from 'streamify-string'

import { decodeJwt, createRemoteJWKSet, jwtVerify, compactVerify } from "jose";

const VC_VERIFICATION_URL = "http://localhost:4444/verify"
const UMA_DISCOVERY = '/.well-known/uma2-configuration';

const REQUIRED_METADATA = [
  'issuer', 
  'jwks_uri', 
  'permission_endpoint', 
  'introspection_endpoint', 
  'resource_registration_endpoint'
];

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
      vendor: 'http://localhost:5123/id',
      present: 'http://localhost:3000/demo/public/bday-app',
    },
    scopes: {
      read: 'urn:example:css:modes:read',
    }
  }

const parser = new Parser();

export async function verifyAuditTokenSignature(entry: AuditEntry): Promise<boolean> {
    const { token, webId } = entry
    try {
        const { payload } = await verifyJwtToken(token, webId)
    } catch (e) {
        console.error(`Could not verify entry: ${JSON.stringify(entry, null, 2)}, error: ${(e as any).toString()}`)
        return false;
    }
    return true;
}

export async function verifyAuditCredentialSignature(entry: AuditEntry) {
    const { data } = entry

    const {  validationResult, verificationResult } = await verifyVCsignature(data)

    if (!validationResult.valid) {
        console.error(`Could not verify credential. Data validation failed for ${JSON.stringify(entry, null, 2)}`)
        return false;
    }
    if (!verificationResult.verified) {
        console.error(`Could not verify credential.\
            Signature verification failed for ${JSON.stringify(entry, null, 2)}`)
        return false;
    }    
    return true
}

export async function verifyCredentialAgeIsAdult(entry: AuditEntry) {
  return processAgeResult(entry.data)
}


/********************
 * HELPER FUNCTIONS *
 ********************/




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

export async function processAgeResult(data: string): Promise<boolean> {
  // todo: process as RDF. Had some issues with streams and browser
  const ageValue = JSON.parse(data).credentialSubject["http://www.w3.org/2006/vcard/ns#bday"]["@value"];
  return calculate_age(ageValue) >= 18

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

  const { payload } = await compactVerify(token, jwkSet);
  
  // todo: Can't do full check because of expiration of token. Need to check issuer and audience claims manually
  // await jwtVerify(token, jwkSet, { issuer: issuer, audience: 'solid' });

  return payload
}

type VCVerificationResult = {
  validationResult: {
    valid: boolean
  }
  verificationResult: {
    verified: boolean
  }
}

export async function verifyVCsignature(data: string): Promise<VCVerificationResult> {
  const verificationUrl = VC_VERIFICATION_URL // todo: dynamic adding of stores etc ...
  
  const res = await fetch(verificationUrl, {
    method: "POST",
    body: data,
    headers: { "Content-Type": "application/json" }
  })
  
  const {validationResult, verificationResult} = (await res.json()) as VCVerificationResult

  return {validationResult, verificationResult}

}


function calculate_age(birthDate: string) {
  const bdate = new Date(birthDate) 
  var diff_ms = Date.now() - bdate.getTime();
  var age_dt = new Date(diff_ms); 
  return Math.abs(age_dt.getUTCFullYear() - 1970);
}