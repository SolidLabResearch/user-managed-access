import { UCRulesStorage } from "./UCRulesStorage";
import * as path from 'path'
import * as fs from 'fs'
import { Store, Writer } from "n3";
import { parseAsN3Store } from "koreografeye";

export class DirectoryUCRulesStorage implements UCRulesStorage {
    private directoryPath: string;
    private addedRulesPath: string;

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

        this.addedRulesPath = path.join(this.directoryPath, 'addedRules.ttl');
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


    /**
     * TEST IMPLEMENTATION - This is just to test the POST :uma/policies endpoint
     * 
     * @param rule The quads to be added
     */
    public async addRule(rule: Store): Promise<void> {
        const writer = new Writer({ format: 'Turtle' });

        writer.addQuads(rule.getQuads(null, null, null, null));

        const serializedTurtle: string = await new Promise((resolve, reject) => {
            writer.end((error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
        });

        // Append or create the file
        if (!fs.existsSync(this.addedRulesPath)) {
            fs.writeFileSync(this.addedRulesPath, serializedTurtle);
        } else {
            fs.appendFileSync(this.addedRulesPath, '\n' + serializedTurtle);
        }

        console.log(`[${new Date().toISOString()}] - Added new rule to ${this.addedRulesPath}`);
    }
    public async getRule(identifier: string): Promise<Store> {
        throw Error('not implemented');
    }
    public async deleteRule(identifier: string): Promise<void> {
        throw Error('not implemented');
    }
}

