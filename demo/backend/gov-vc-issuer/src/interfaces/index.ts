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

export type DocumentLoaderResponse = {
    contextUrl: null | string
    documentUrl: null | string
    document: any
}

export interface IDocumentLoader {
    (url: any): Promise<DocumentLoaderResponse>
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
