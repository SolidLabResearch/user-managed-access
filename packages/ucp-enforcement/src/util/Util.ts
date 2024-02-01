import { RequestInfo } from "../storage/ContainerUCRulesStorage";
import { Store } from "n3";
import { turtleStringToStore } from "./Conversion";


export async function readLdpRDFResource(fetch: (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>, resourceURL: string): Promise<Store> {
    const containerResponse = await fetch(resourceURL);

    if (containerResponse.status !== 200) {
        throw new Error(`Resource not found: ${resourceURL}`);
    }
    if (containerResponse.headers.get('content-type') !== 'text/turtle') { // note: should be all kinds of RDF, not only turtle
        throw new Error('Works only on rdf data');
    }
    const text = await containerResponse.text();
    return await turtleStringToStore(text, resourceURL);
}
/**
 * A recursive search algorithm that gives all quads that a subject can reach (working with circles)
 *
 * @param store
 * @param subjectIRI
 * @param existing IRIs that already have done the recursive search (IRIs in there must not be searched for again)
 * @returns
 */

export function extractQuadsRecursive(store: Store, subjectIRI: string, existing?: string[]): Store {
    const tempStore = new Store();
    const subjectIRIQuads = store.getQuads(subjectIRI, null, null, null);

    tempStore.addQuads(subjectIRIQuads);
    const existingSubjects = existing ?? [subjectIRI];

    for (const subjectIRIQuad of subjectIRIQuads) {
        if (!existingSubjects.includes(subjectIRIQuad.object.id)) {
            tempStore.addQuads(extractQuadsRecursive(store, subjectIRIQuad.object.id, existingSubjects).getQuads(null, null, null, null));
        }
        else {
            tempStore.addQuad(subjectIRIQuad);
        }
        existingSubjects.push(subjectIRIQuad.object.id);
    }
    return tempStore;
}// instantiated policy consisting of one agreement and one rule

export interface SimplePolicy {
    // representation of the ucon rule + agreement
    representation: Store;
    // identifier of the agreement
    agreementIRI: string;
    // identifier of the rule
    ruleIRI: string;
}

