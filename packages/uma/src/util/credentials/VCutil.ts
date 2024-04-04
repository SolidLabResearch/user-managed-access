import jsonld from "jsonld";
import N3 from "n3";
import urljoin from "url-join";
import {buildAuthenticatedFetch, createDpopHeader, generateDpopKeyPair} from "@inrupt/solid-client-authn-core";
// @ts-ignore
import {JsonLdDocumentLoader} from 'jsonld-document-loader';
import * as util from 'node:util'

import {VCDIVerifiableCredential} from "@digitalcredentials/vc-data-model/dist/VerifiableCredential";

export interface IKeyExport {
    type: string
    id: string
    controller: string
    publicKeyMultibase: string
    privateKeyMultibase: string
}

export interface IVerificationMethod {
    id: string
    controller: string
    type: string
    publicKeyJwk?: object
    publicKeyMultibase?: string
    publicKeyBase58?: string
}

export interface IServiceEndpoint {
    id: string
    type: string | string[]
    serviceEndpoint: string | string[]
}

/**
 * https://www.w3.org/TR/did-core/#did-document-properties
 */
export interface IDidDocument {
    '@context': string | string[]
    id: string
    alsoKnownAs?: string | string[]
    controller?: string | string[]

    // Verification Methods
    verificationMethod?: (IVerificationMethod | string)[]
    authentication?: (IVerificationMethod | string)[]
    assertionMethod?: (IVerificationMethod | string)[]
    keyAgreement?: (IVerificationMethod | string)[]
    capabilityInvocation?: (IVerificationMethod | string)[]
    capabilityDelegation?: (IVerificationMethod | string)[]

    service?: (IServiceEndpoint | string)[]
}

/**
 * TYPES
 */
export type BaseParameters = {
    documentLoader: any
}
export type K = KeyPair
export type SignParameters = BaseParameters & {
    credential: VCDIVerifiableCredential
    key: K
}
export type VerifyParameters = BaseParameters & {
    credential: VCDIVerifiableCredential
}
export type ExportKeyParameters = {
    publicKey: boolean
    includeContext: boolean
    secretKey?: boolean // used by @digitalbazaar
    privateKey?: boolean // used by @digitalcredentials
}
export type VerifyResult = {
    verificationResult: any,
    error: any
}

/**
 * INTERFACES
 */
export interface SerializedKeyPair {
    '@context'?: string;
    id?: string;
    type?: string;
    controller?: string;
    revoked?: string;
    /**
     * Public / private key material
     */
    publicKeyBase58?: string;
    privateKeyBase58?: string;
    publicKeyMultibase?: string;
    privateKeyMultibase?: string;
    publicKeyJwk?: object;
    privateKeyJwk?: object;
}

export interface KeyPair extends SerializedKeyPair {
    id?: string;
    type?: string;
    controller?: string;
    revoked?: string;
    'export': Function;
    signer?: Function
}



export type DocumentLoaderResponse = {
    contextUrl: null | string
    documentUrl: null | string
    document: any
}

export interface IDocumentLoader {
    (url: any): Promise<DocumentLoaderResponse>
}

export function printObject(x: any) {
    console.log(util.inspect(x,{showHidden: false, depth: null, colors: true}))
}
export async function convertNQuadsToJSONLD(nquads: string): Promise<object> {

    return new Promise(async (resolve, reject) => {
        try {
            // Note: fromRDF requires an object as input
            const jsonldData = await jsonld.fromRDF(
                (nquads as unknown) as object,
                {format: 'application/n-quads'});
            resolve(jsonldData)
        } catch (error) {
            reject(error)
        }
    })

}

export async function ttl2jld(ttl: string, baseIri?: string): Promise<object> {
    const store = await ttl2store(ttl, baseIri)
    const jld = await jsonld.fromRDF(store,)
    return jld
}

export async function ttl2store(ttl: string, baseIRI?: string): Promise<N3.Store> {
    const quads = new N3.Parser({
        format: 'text/turtle',
        baseIRI
    }).parse(ttl);
    return new N3.Store(quads)
}

///
async function getAuthorisation(email: string, password: string, serverUrl: string) {
// First we request the account API controls to find out where we can log in
    const indexResponse = await fetch(urljoin(serverUrl, '.account/'));
    const {controls} = await indexResponse.json() as any

// And then we log in to the account API
    const response = await fetch(controls.password.login, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({email: email, password: password}),
    });
// This authorization value will be used to authenticate in the next step
    const {authorization} = await response.json() as any
    return authorization;
}

async function generateToken(webId: string, serverUrl: string, authorization: string) {
    // First we need to request the updated controls from the server now that we are logged in.
    // These will now have more values than in the previous example.
    const indexResponse = await fetch(urljoin(serverUrl + '.account/'), {
        headers: {authorization: `CSS-Account-Token ${authorization}`}
    });
    const {controls} = await indexResponse.json() as any;

    // Here we request the server to generate a token on our account
    const response = await fetch(controls.account.clientCredentials, {
        method: 'POST',
        headers: {authorization: `CSS-Account-Token ${authorization}`, 'content-type': 'application/json'},
        // The name field will be used when generating the ID of your token.
        // The WebID field determines which WebID you will identify as when using the token.
        // Only WebIDs linked to your account can be used.
        body: JSON.stringify({name: 'my-token', webId: webId}),
    });

    // These are the identifier and secret of your token.
    // Store the secret somewhere safe as there is no way to request it again from the server!
    // The `resource` value can be used to delete the token at a later point in time.
    //const { id, secret, resource } = await response.json();
    const token = await response.json() // contains id, secret, resource
    return token;
}

async function requestAccessToken(token: any, serverUrl: string) {
    const {id, secret} = token;

    // A key pair is needed for encryption.
    // This function from `solid-client-authn` generates such a pair for you.
    const dpopKey = await generateDpopKeyPair();

// These are the ID and secret generated in the previous step.
// Both the ID and the secret need to be form-encoded.
    const authString = `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`;
// This URL can be found by looking at the "token_endpoint" field at
// http://localhost:3000/.well-known/openid-configuration
// if your server is hosted at http://localhost:3000/.
    const tokenUrl = urljoin(serverUrl, '.oidc/token');
    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            // The header needs to be in base64 encoding.
            authorization: `Basic ${Buffer.from(authString).toString('base64')}`,
            'content-type': 'application/x-www-form-urlencoded',
            dpop: await createDpopHeader(tokenUrl, 'POST', dpopKey),
        },
        body: 'grant_type=client_credentials&scope=webid',
    });

// This is the Access token that will be used to do an authenticated request to the server.
// The JSON also contains an "expires_in" field in seconds,
// which you can use to know when you need request a new Access token.
    const {access_token, expires_in} = await response.json() as any;

    const today = new Date();
    today.setSeconds(today.getSeconds() + expires_in);

    return {
        accessToken: access_token,
        expiresOn: today,
        dpopKey
    }
}

export async function getAuthenticatedFetch(email: string, password: string, serverUrl: string, webId: string) {

    console.log('Generating access token');
    const authorisation = await getAuthorisation(email, password, serverUrl);
    const token = await generateToken(webId, serverUrl, authorisation);
    const {accessToken, dpopKey} = await requestAccessToken(token, serverUrl);

// The DPoP key needs to be the same key as the one used in the previous step.
// The Access token is the one generated in the previous step.
    const authFetch = await buildAuthenticatedFetch(accessToken, {dpopKey});
// authFetch can now be used as a standard fetch function that will authenticate as your WebID.
    console.log("authFetch ready");
    return authFetch;
}

export async function parseToJsonLD(data: any, contentType: string) {
    let parsedData = undefined;
    switch (contentType) {
        case 'application/n-quads':
            parsedData = await convertNQuadsToJSONLD(data)
            break;
        case 'text/turtle':
            parsedData = await ttl2jld(data)
            break;
        case 'application/json':
        case 'application/ld+json':
            parsedData = JSON.parse(data)
            break
        default:
            throw new Error(`Content-type: ${contentType} not yet supported!`)
    }
    return parsedData
}

export function getCurrentDateTime() {
    const now = new Date();

    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}

export function createDocumentLoader(jdl: JsonLdDocumentLoader): IDocumentLoader {
    const dl = jdl.build()
    return async (url: string) => {
        let resolvedDocument = undefined
        try {
            console.log(`🔗\t${url}`)
            resolvedDocument = await dl(url)
        } catch (error) {
            // resolve from network
            let document = await (await fetch(url, {headers: {'accept': 'application/json'}})).json()
            resolvedDocument = {
                contextUrl: null,
                document,
                documentUrl: url
            }
        }
        if (!resolvedDocument)
            throw new Error(`COULD NOT RESOLVE DOCUMENT FOR ${url}`)
        return resolvedDocument
    }
}

export function Vocab(ns: string) {
    return (p: string) => {
        return ns.endsWith('#') || ns.endsWith('/') ?
            ns.concat(p) : ns.concat('#', p)
    }
}
