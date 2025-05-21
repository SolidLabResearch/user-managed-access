import { UCRulesStorage } from "./UCRulesStorage";
import * as path from 'path'
import * as fs from 'fs'
import { Store } from "n3";
import { parseAsN3Store } from "koreografeye";

/**
 * Reads rules from files on disk and caches them in memory.
 * The read only happens once, after which the data will be retained in memory.
 */
export class DirectoryUCRulesStorage implements UCRulesStorage {
    protected readonly store: Store = new Store();
    protected filesRead: boolean = false;

    /**
     *
     * @param directoryPath The absolute path to a directory
     */
    public constructor(protected readonly directoryPath: string) {
        this.directoryPath = path.resolve(directoryPath);
        console.log(`[${new Date().toISOString()}] - DirectoryUCRulesStore: Path that will be used as source directory for the Usage Control Rules`, this.directoryPath);
        if (!fs.lstatSync(directoryPath).isDirectory()) {
            throw Error(`${directoryPath} does not resolve to a directory`)
        }
    }

    public async getStore(): Promise<Store> {
        if (this.filesRead) {
            return this.store;
        }

        const files = fs.readdirSync(this.directoryPath).map(file => path.join(this.directoryPath, file))
        for (const file of files) {
            const fileStore = await parseAsN3Store(file)
            this.store.addQuads(fileStore.getQuads(null, null, null, null))
        }
        this.filesRead = true;
        return this.store;
    }


    public async addRule(rule: Store): Promise<void> {
        this.store.addQuads(rule.getQuads(null, null, null, null));
    }


    public async removeData(data: Store): Promise<void> {
        this.store.removeQuads(data.getQuads(null, null, null, null));
    }

    public async getRule(identifier: string): Promise<Store> {
        throw Error('not implemented');
    }
    public async deleteRule(identifier: string): Promise<void> {
        throw Error('not implemented');
    }
}
