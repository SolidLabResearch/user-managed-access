import { ASYMMETRIC_CRYPTOGRAPHIC_ALGORITHM }
  from '@solid/access-token-verifier/dist/constant/ASYMMETRIC_CRYPTOGRAPHIC_ALGORITHM';
import { HttpHandler } from '../util/http/models/HttpHandler';
import { HttpHandlerContext } from '../util/http/models/HttpHandlerContext';
import { HttpHandlerResponse } from '../util/http/models/HttpHandlerResponse';
import { Logger } from '../util/logging/Logger';
import { getLoggerFor } from '../util/logging/LoggerUtils';
import { getOperationLogger } from '../logging/OperationLogger';
import { Quad } from 'n3';
import { serializeQuads } from '@solid/community-server';


/**
 * An HttpHandler used for returning the logs 
 * stored in the UMA Authorization Service.
 */
export class VCRequestVerificationHandler extends HttpHandler {
  protected readonly logger: Logger = getLoggerFor(this);

  operationLogger = getOperationLogger()

  /**
  * An HttpHandler used for returning the configuration
  * of the UMA Authorization Service.
    * @param {string} baseUrl - Base URL of the AS
    */
  constructor() {
    super();
  }

  /**
   * Returns the endpoint's UMA configuration
   *
   * @param {HttpHandlerContext} context - an irrelevant incoming context
   * @return {Observable<HttpHandlerResponse>} - the mock response
   */
  async handle(context: HttpHandlerContext): Promise<HttpHandlerResponse> {
    this.logger.info(`Received VC endpoint request at '${context.request.url}'`);
    
    return {
      body: '<this> <is> "the vc endpoint".',
      headers: {'content-type': 'application/trig'},
      status: 200,
    };
  }

}



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Gertjan VC stuff
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

import {VCDIVerifiableCredential} from "@digitalcredentials/vc-data-model/dist/VerifiableCredential";

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
// Helper Functions
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

