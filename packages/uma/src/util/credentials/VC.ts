import {CredentialSubject, VCDIVerifiableCredential} from "@digitalcredentials/vc-data-model/dist/VerifiableCredential";
// @ts-ignore
import cred from 'credentials-context';
// @ts-ignore
import jsigs from 'jsonld-signatures';
// @ts-ignore
import {JsonLdDocumentLoader} from 'jsonld-document-loader';
//@ts-ignore
import {cryptosuite as eddsa2022CryptoSuite} from '@digitalbazaar/eddsa-2022-cryptosuite';
//@ts-ignore
import {DataIntegrityProof} from '@digitalbazaar/data-integrity';
import {
    ExportKeyParameters, IDidDocument, K, SerializedKeyPair, SignParameters, VerifyParameters, getCurrentDateTime
} from "./VCutil";
//@ts-ignore
import * as Ed25519Multikey from '@digitalbazaar/ed25519-multikey';
// @ts-ignore
import dataIntegrityContext from '@digitalbazaar/data-integrity-context';
import jsonld from "jsonld";
import {AccessModes, getResourceInfo, overwriteFile, universalAccess, UrlString} from "@inrupt/solid-client";

const {contexts: credentialsContexts, constants: {CREDENTIALS_CONTEXT_V1_URL}} =
    cred;
const {purposes: {AssertionProofPurpose}} = jsigs;

export function isVC(o: any) {

    let valid = false;
    let validationError = undefined
    try {
        // check type presence and cardinality
        if(!o.type) {
            throw new Error('"type" property is required.');
        }
        if(!o.credentialSubject) {
            throw new Error('"credentialSubject" property is required.');
        }
        if(!o.issuer) {
            throw new Error('"issuer" property is required.');
        }
        // No errors thrown? Valid!
        valid = true

    } catch (error: any) {
        validationError = error.toString()
    } finally {
        return {valid, validationError}
    }


}

/**
 * [Depends on key implementations]
 * @param key
 */
function createSignSuite(key: K) {
    return new DataIntegrityProof({
        signer: key.signer!(),
        cryptosuite: eddsa2022CryptoSuite
    })
}

/**
 * [Depends on key implementations]
 */
function createVerifySuite() {
    return new DataIntegrityProof({
        cryptosuite: eddsa2022CryptoSuite
    });
}
/**
 * CONTROLLER FUNCTIONS
 * @param params
 */
export async function sign(params: SignParameters) {

    const {documentLoader, key, credential}  = params
    // const suite = new Ed25519Signature2020({key})

    const suite = createSignSuite(key)
    const signedCredential = await jsigs.sign(credential, {
        suite,
        purpose: new AssertionProofPurpose(),
        documentLoader
    });
    return signedCredential
}

/**
 *
 * @param params
 */
export async function verify(params: VerifyParameters) {
    const {credential, documentLoader} = params
    const validationResult = isVC(credential)

    const suite = createVerifySuite()

    const verifyParams = {
        suite,
        purpose: new AssertionProofPurpose(),
        documentLoader
    }
    const verificationResult = await jsigs.verify(
        credential,
        verifyParams
    )
    return {
        validationResult,
        verificationResult
    }
}

export function createCredential(k: K, credentialSubject: CredentialSubject): VCDIVerifiableCredential {
    return {
        '@context': [CREDENTIALS_CONTEXT_V1_URL],
        type: ['VerifiableCredential'],
        issuer: k.controller!,
        issuanceDate: getCurrentDateTime(),
        credentialSubject: credentialSubject
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// HELPERS
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function getKeypairUrl(webId: string): string {
    return webId.replace('/profile/card#me', '/keypair')
}
export function getKeyControllerDocumentUrl(webId: string): string {
    return webId.replace('/card#me','/key')
}
export function getCardUrl(webId: string) :string {
    return webId.replace('#me','')
}
export async function storeKeypairOnSolidPod(key: K, webId: string, authFetch: any) {
    // Upload key to pod (private location)
    const privateExport = await exportKeypair(key,
        { publicKey: true,  secretKey: true,  includeContext: true})

    const urlKeypair = getKeypairUrl(webId)
    let response = await authFetch(urlKeypair, {
        method: 'PUT',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(privateExport)
    });

    if(!response.ok)
        throw new Error('Failed to upload keypair!')
}
export async function fetchKeypairFromSolidPod(webId: string, authFetch: any) {
    // Get keypair -- url convention determined by getKeypairUrl
    const urlKeypair = getKeypairUrl(webId)
    const response = await authFetch(urlKeypair)

    let kpResource = await response.json()

    const kp = await Ed25519Multikey.from(kpResource)
    // const kp = await Ed25519VerificationKey2020.fromKeyDocument({document: kpResource as any})
    return kp

}

/**
 * [Depends on key implementations]
 * @param webId
 * @param password
 */
export async function createKey(webId: string, password: string): Promise<K> {
    const keyId = getKeyControllerDocumentUrl(webId)

    let seed = new Uint8Array(32)
    seed = Buffer.alloc(32, Uint8Array.from(Buffer.from(password)))
    const k = await Ed25519Multikey.generate({seed,
        id: keyId,
        controller: webId
    })

    return k
}

export function preloadDocumentLoaderContexts(jdl: JsonLdDocumentLoader) {
    jdl.addStatic(
        CREDENTIALS_CONTEXT_V1_URL,
        credentialsContexts.get(CREDENTIALS_CONTEXT_V1_URL)
    )

    jdl.addStatic(
        dataIntegrityContext.constants.CONTEXT_URL,
        dataIntegrityContext.contexts.get(dataIntegrityContext.constants.CONTEXT_URL)
    );
}


/**
 *
 * @param k
 * @param embedVerificationMethod: if true, keymaterial will be embedded Otherwise, url
 */
export function createControllerDocument(k : any, embedVerificationMethod = false): IDidDocument {
    const vm = embedVerificationMethod ? k : k.id
    const controllerDocument = {
        "@context": [
            "https://www.w3.org/ns/did/v1"
        ],
        "id": k.controller,
        "verificationMethod": [
            vm
        ],
        "assertionMethod": [
            k.id
        ]
    }
    return controllerDocument
}


export const addControllerDocumentToCard = async function(
    authFetch: typeof fetch,
    webId: string,
    controllerDoc: any
){
    const kRdf = await jsonld.toRDF(
        controllerDoc, {format: 'application/n-quads'}
    )

    const patchInsert = Object(kRdf).toString()
    const url= getCardUrl(webId)
    await n3patch(
        url,
        authFetch,
        undefined,
        patchInsert
    )
}

/**
 * Add file to a Solid Pod Container.
 * @param urlContainer
 * @param data
 * @param mimeType
 * @param slug
 * @param publicAccess
 */
export async function addFileToContainer(
    authFetch: typeof fetch,
    urlContainer: string,
    data: Buffer,
    mimeType = 'application/ld+json',
    slug: string,
    publicAccess?: AccessModes
) {

    const file = new Blob([data])
    const fileUrl = new URL(slug, urlContainer).toString() as UrlString

    await overwriteFile(
        fileUrl,
        file,
        {contentType: mimeType, fetch: authFetch}
    )

    const serverResourceInformation = await getResourceInfo(fileUrl, {fetch: authFetch})
    if (publicAccess!!) {
        await universalAccess.setPublicAccess(
            serverResourceInformation.internal_resourceInfo.sourceIri, publicAccess!, {fetch: authFetch})
    }
    return serverResourceInformation.internal_resourceInfo.sourceIri

}

export async function exportKeypair(key: K, params: ExportKeyParameters): Promise<SerializedKeyPair> {
    /// ⚠️ Note: export params depend on implementation of the key.
    // For example, to indicate the export of the private/secret key,
    // @digitalbazaar/ed25519-multikey uses secretKey, while
    // @digitalcredentials/ed25519-verification-key-2020 uses privateKey
    return await key.export(params)
}
/**
 * Spec: https://solid.github.io/specification/protocol#writing-resources
 * @param url
 * @param where
 * @param inserts
 * @param deletes
 * @param prefixes
 */
export async function  n3patch(url: string,
                        authFetch: Function,
    where?: string,
    inserts?: string,
    deletes?: string,
    prefixes?: Record<string, string>

) {

    const clauses = [
        where ? `solid:where { ${where} }` : where,
        inserts ? `solid:inserts { ${inserts} }` : inserts,
        deletes ? `solid:deletes { ${deletes} }` : deletes,
    ].filter(c => c!!).join(';\n')


    const n3Patch = `
        @prefix solid: <http://www.w3.org/ns/solid/terms#>.
        ${
        prefixes! ? Object.entries(prefixes!).map(([p, ns]) => `@prefix ${p}: <${ns}> .`).join('\n') : ''
    }
        
        _:rename a solid:InsertDeletePatch;
            ${clauses}
        .
        `

    const response = await authFetch(
        url,
        {
            method: 'PATCH',
            headers: {
                'content-type': "text/n3"
            },
            body: n3Patch
        }
    )

    const {ok, status, statusText} = response
    if (!ok)
        throw new Error(`
            N3 Patch failed.
            Url: ${url}
            Status: ${status} - ${statusText}
            N3 Patch:\n${n3Patch}
            `)

}
