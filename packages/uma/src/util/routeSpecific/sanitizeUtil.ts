import { Store } from "n3";

/**
 * Check whether all subjects in the new store
 * are absent from the existing store.
 *
 * This is used to ensure no pre-existing entities
 * are being redefined.
 *
 * @param store the original store
 * @param newStore the store containing new data
 * @returns true if no subjects are already defined, false otherwise
 */
export const noAlreadyDefinedSubjects = (store: Store, newStore: Store): boolean =>
    newStore.getSubjects(null, null, null)
        .every((subject) => store.countQuads(subject, null, null, null) === 0);
export class ConflictError extends Error {
    constructor() { super(`Resource already exists`); }
}
