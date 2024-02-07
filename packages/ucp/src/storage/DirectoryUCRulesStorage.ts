import { UCRulesStorage } from "./UCRulesStorage";
import * as path from 'path'
import * as fs from 'fs'
import { Store } from "n3";
import { parseAsN3Store } from "koreografeye";

export class DirectoryUCRulesStorage implements UCRulesStorage {
    private directoryPath: string;
    /**
     * 
     * @param directoryPath The absolute path to a directory
     */
    public constructor(directoryPath: string) {
        this.directoryPath = path.resolve(directoryPath);
        console.log(`[${new Date().toISOString()}] - DirectoryUCRulesStore: Path that will be used as source directory for the Usage Control Rules`, this.directoryPath);
        if (!fs.lstatSync(directoryPath).isDirectory()) {
            throw Error(`${directoryPath} does not resolve to a directory`)
        }
    }

    public async getStore(): Promise<Store> {
        const store = new Store()

        const files = fs.readdirSync(this.directoryPath).map(file => path.join(this.directoryPath, file))
        for (const file of files) {
            const fileStore = await parseAsN3Store(file)
            store.addQuads(fileStore.getQuads(null, null, null, null))
        }
        return store;
    }


    public async addRule(rule: Store): Promise<void> {
        throw Error('not implemented');
    }
    public async getRule(identifier: string): Promise<Store> {
        throw Error('not implemented');
    }
    public async deleteRule(identifier: string): Promise<void> {
        throw Error('not implemented');
    }
}

