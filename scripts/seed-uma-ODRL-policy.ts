import * as readline from 'readline';
import { seedingPolicies, seedingPolicies2, seedingPolicies3 } from './util/policyExamples';

async function seedForOneClient(id: string) {
    await fetch("http://localhost:4000/uma/policies", { method: 'POST', headers: { 'Authorization': `WebID ${encodeURIComponent(id)}`, 'Content-Type': 'text/turtle' }, body: Buffer.from(seedingPolicies3(id), 'utf-8') });
}

async function deleteForOneClient(id: string) {
    const policyIds = [
        'http://example.org/usagePolicy1-read',
        'http://example.org/usagePolicy1-write',
        'http://example.org/usagePolicy1-append',
        'http://example.org/usagePolicy1a-control-1',
        'http://example.org/usagePolicy1a-control-2',
        'http://example.org/usagePolicy3-create',
        'http://example.org/usagePolicy3b-create',
        'http://example.org/usagePolicy3b-read',
        'http://example.org/usagePolicy3b-write',
        'http://example.org/usagePolicy3b-control',
        'urn:uuid:policy-read',
        'urn:uuid:policy-append',
        'urn:uuid:policy-write',
    ];

    for (const policyId of policyIds) {
        await fetch(`http://localhost:4000/uma/policies/${encodeURIComponent(policyId)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `WebID ${encodeURIComponent(id)}` }
        });
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
