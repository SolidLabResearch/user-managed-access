import { Store } from "n3";

export interface AccessRequestStorage {
    getStore: () => Store;

    /**
     * Add a new access Acces Request to the storage
     * @param request
     * @returns
     */
    addAccessRequest: (request: Store) => Promise<void>;

    /**
     * Get an Access Request from the storage
     * @param identifier
     * @returns
     */
    getAccessRequest: (requestingPartyId: string) => Promise<Store>;

    /**
     * Delete an Access request from the storage
     * @param identifier
     * @returns
     */
    deleteAccessRequest: (query: string) => Promise<void>;

    /**
     * Update an Access Request from the storage
     * @param request
     * @returns
     */
    updateAccessRequest: (query: string) => Promise<void>;
}
