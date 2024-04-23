import { createDocumentLoader } from './utils/index.js';
// @ts-ignore
import { JsonLdDocumentLoader } from 'jsonld-document-loader';
import {
    preloadDocumentLoaderContexts,
    verify
} from "./controller/index.js";

const jdl = new JsonLdDocumentLoader();
preloadDocumentLoaderContexts(jdl)

async function myVerify(verifiableCredential: any) {
    const documentLoader = createDocumentLoader(jdl)

    return await verify({
        credential: verifiableCredential,
        documentLoader
    })
}

export default myVerify;
