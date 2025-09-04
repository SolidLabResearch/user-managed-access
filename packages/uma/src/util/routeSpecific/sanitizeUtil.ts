import { Store } from "n3";

// check if there are no subjects in newStore that are already in Store
export const noAlreadyDefinedSubjects = (store: Store, newStore: Store): boolean =>
    newStore.getSubjects(null, null, null)
        .every((subject) => store.countQuads(subject, null, null, null) === 0);
