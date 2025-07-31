import { UCRulesStorage } from "./UCRulesStorage";
import * as path from 'path'
import * as fs from 'fs'
import { Parser, Store, Writer } from 'n3';

export class DirectoryUCRulesStorage implements UCRulesStorage {
    protected directoryPath: string;
    protected readonly baseIRI: string;

    /**
     *
     * @param directoryPath The absolute path to a directory
     * @param baseIRI The base to use when parsing RDF documents.
     */
    public constructor(directoryPath: string, baseIRI: string) {
        this.directoryPath = path.resolve(directoryPath);
        if (!fs.lstatSync(directoryPath).isDirectory()) {
            throw Error(`${directoryPath} does not resolve to a directory`)
        }
        this.baseIRI = baseIRI;
    }

    public async getStore(): Promise<Store> {
        const store = new Store()

        const parser = new Parser({ baseIRI: this.baseIRI });
        const files = fs.readdirSync(this.directoryPath).map(file => path.join(this.directoryPath, file))
        for (const file of files) {
            const quads = parser.parse((await fs.promises.readFile(file)).toString());
            store.addQuads(quads);
        }
        return store;
    }

    async deleteRuleFromPolicy(ruleID: string, PolicyID: string) {
        return new Promise<void>(() => { })
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
