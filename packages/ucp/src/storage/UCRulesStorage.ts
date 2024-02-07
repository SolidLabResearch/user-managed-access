import { Store } from "n3";

export interface UCRulesStorage {
    getStore: () => Promise<Store>;
    /**
     * Add a single Usage Control Rule to the storage
     * @param rule 
     * @returns 
     */
    addRule: (rule: Store) => Promise<void>;
    /**
     * Get a Usage Control Rule from the storage
     * @param identifier 
     * @returns 
     */
    getRule: (identifier: string) => Promise<Store>;
    /**
     * Delete a Usage Control Rule from the storage
     * @param identifier 
     * @returns 
     */
    deleteRule: (identifier: string) => Promise<void>;
}