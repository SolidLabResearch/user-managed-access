import * as readline from 'readline';
import { seedingPolicies } from './util/policyExamples';

async function seedForOneClient(id: string) {
    await fetch("http://localhost:4000/uma/policies", { method: 'POST', headers: { 'Authorization': id, 'Content-Type': 'text/turtle' }, body: Buffer.from(seedingPolicies(id), 'utf-8') });
}

async function deleteForOneClient(id: string) {
    for (const policyId of ['http://example.org/usagePolicy1', 'http://example.org/usagePolicy1a', 'http://example.org/usagePolicy3', 'urn:uuid:95efe0e8-4fb7-496d-8f3c-4d78c97829bc']) {
        await fetch(`http://localhost:4000/uma/policies/${encodeURIComponent(policyId)}`, { method: 'DELETE', headers: { 'Authorization': id } })
    }
}

async function main() {
    let started: 'NO' | 'SEED' | 'DELETE' = 'NO';
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    console.log("Do you want to seed or delete? (type 'seed' or 'delete')");
    rl.on('line', async (input) => {
        if (started === 'NO') {
            if (input === "seed") {
                started = 'SEED';
                console.log("Type the webID that you wish to seed, or cancel:");
            }
            else if (input === "delete") {
                console.log("Type the webID of the client who's seeded data you want to delete, or cancel:")
                started = 'DELETE';
            }
            else
                console.log("Type 'seed' or 'delete'")
        } else {
            if (input === 'cancel')
                started = 'NO';
            else if (started === 'SEED') {
                await seedForOneClient(input);
                console.log('seeding completed')
            } else {
                await deleteForOneClient(input);
                console.log('deleting complete')
            }
            console.log("Do you want to seed or delete? (type 'seed' or 'delete')");
            started = 'NO';
        }

    });
}

main();