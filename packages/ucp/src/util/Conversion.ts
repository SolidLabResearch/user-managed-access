import { parseStringAsN3Store } from "koreografeye";
import {DataFactory, Store, Writer} from "n3";

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