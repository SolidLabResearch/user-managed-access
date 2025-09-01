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
     * @param requestingPartyId
     * @returns
     */
    getAccessRequest: (requestingPartyId: string) => Promise<Store>;

    /**
     * Update an Access Request from the storage
     * @param query
     * @returns
     */
    updateAccessRequest: (query: string) => Promise<void>;
}
