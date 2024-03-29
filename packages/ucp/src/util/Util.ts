import { Store } from "n3";

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

