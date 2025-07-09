import { UCRulesStorage } from "./UCRulesStorage";
import * as path from 'path'
import * as fs from 'fs'
import { Parser, Store } from 'n3';

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
     * @param baseIRI The base to use when parsing RDF documents.
     */
    public constructor(
      protected readonly directoryPath: string,
      protected readonly baseIRI: string,
    ) {
        this.directoryPath = path.resolve(directoryPath);
        if (!fs.lstatSync(directoryPath).isDirectory()) {
            throw Error(`${directoryPath} does not resolve to a directory`)
        }
        this.baseIRI = baseIRI;
    }

    public async getStore(): Promise<Store> {
        if (this.filesRead) {
            return this.store;
        }

        const parser = new Parser({ baseIRI: this.baseIRI });
        const files = fs.readdirSync(this.directoryPath).map(file => path.join(this.directoryPath, file))
        for (const file of files) {
            const quads = parser.parse((await fs.promises.readFile(file)).toString());
            this.store.addQuads(quads);
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
