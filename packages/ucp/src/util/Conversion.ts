import { parseStringAsN3Store } from "koreografeye";
import {DataFactory, Store, Writer} from "n3";
import { ReadableWebToNodeStream } from "@smessie/readable-web-to-node-stream"
import rdfParser from 'rdf-parse'
import { storeStream } from "rdf-store-stream";

/**
 * Converts a store to turtle string
 * @param store
 * @returns {string}
 */
export function storeToString(store: Store): string {
    const writer = new Writer();
    return writer.quadsToString(store.getQuads(null, null, null, null));
}

export async function turtleStringToStore(text: string, baseIRI?: string): Promise<Store> {
    return await parseStringAsN3Store(text, {contentType: 'text/turtle', baseIRI});
}

export async function rdfToStore(response: Response, uri: string){
    const response2 = response.clone()
    const resourceText = await response.text()
    let contentType = response.headers.get("content-type")
    console.log('contentType', contentType, uri)
    if (!contentType) contentType = 'text/turtle' // fallback
    const readableWebStream = response2.body;
    if(!readableWebStream) throw new Error();
    const bodyStream = new ReadableWebToNodeStream(readableWebStream);
    const quadStream = rdfParser.parse(bodyStream, {
      contentType,
      baseIRI: uri
    })
    const store = await storeStream(quadStream) as Store;
    return store
}

export async function isRDFContentType(contentType: string) {
    return (await rdfParser.getContentTypes()).indexOf(contentType) !== -1
}