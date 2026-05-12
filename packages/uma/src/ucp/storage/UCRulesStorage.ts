import { Store } from "n3";

/**
 * A read-only view of an N3 Store.
 * All write/mutation methods are excluded.
 */
export type ReadOnlyStore = Omit<
  Store,
  | 'addAll'
  | 'deleteMatches'
  | 'add'
  | 'addQuad'
  | 'addQuads'
  | 'delete'
  | 'import'
  | 'removeQuad'
  | 'removeQuads'
  | 'remove'
  | 'removeMatches'
  | 'deleteGraph'
  | 'clear'
>;

export interface UCRulesStorage {
    getStore: () => Promise<ReadOnlyStore>;
    /**
     * Add a single Usage Control Rule to the storage
     * @param rule
     * @returns
     */
    addRule: (rule: ReadOnlyStore) => Promise<void>;
    /**
     * Get a Usage Control Rule from the storage
     * @param identifier
     * @returns
     */
    getRule: (identifier: string) => Promise<ReadOnlyStore>;
    /**
     * Delete a Usage Control Rule from the storage
     * @param identifier
     * @returns
     */
    deleteRule: (identifier: string) => Promise<void>;
    /**
     * Delete a Usage Control Rule with its reference from the storage
     * @param identifier
     * @returns
     */
    deleteRuleFromPolicy: (ruleID: string, PolicyID: string) => Promise<void>;
    /**
     * Removes specific triples from the storage.
     * @param data
     */
    removeData: (data: ReadOnlyStore) => Promise<void>;
}
