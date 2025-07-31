import { UserManagedAccessFetcher } from "./util/UMA-client";
import * as readline from 'readline';

const claim_token_format = 'urn:solidlab:uma:claims:formats:webid';

const testCode = (code: number, shouldBe: number = 2, trunc: boolean = true): boolean => {
    return (trunc ? Math.trunc(code / 100) : code) === shouldBe;
};

async function traverseFile(text: string, claim_token: string, resource: string) {
    const fetcher = new UserManagedAccessFetcher({
        token: claim_token,
        token_format: claim_token_format
    });

    console.log(`\nTest creation/modification rights with RPT`);
    const response = await fetcher.fetch(resource, {
        method: "PUT",
        body: text
    });

    if (testCode(response.status)) {
        console.log(`Document created. Server responded with status code ${response.status}`);
    } else {
        console.log(`Access denied. Creation responded with status code ${response.status}`);
    }

    console.log(`\nTesting reading rights with RPT`);
    const readingResponse = await fetcher.fetch(resource);

    if (testCode(readingResponse.status)) {
        const contents = await readingResponse.text();
        console.log(`Reading successful (status ${readingResponse.status}). Contents:\n${contents}\n`);
    } else {
        console.log(`Access denied. Insufficient reading rights (status ${readingResponse.status})`);
    }
}

async function main() {
    let state: 'NO' | 'ResourceSet' | 'AssigneeSet' = 'NO';
    let resourceId = "";
    let assigneeId = "";

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("What resource file do you want to write to?");

    rl.on('line', async (input) => {
        switch (state) {
            case 'NO':
                resourceId = input;
                state = 'ResourceSet';
                console.log("What is your WebID?");
                break;

            case 'ResourceSet':
                assigneeId = input;
                state = 'AssigneeSet';
                console.log("What do you want to write?");
                break;

            case 'AssigneeSet':
                await traverseFile(input, assigneeId, resourceId);
                console.log("\n\n\n*************************************************\n\n\nWhat resource file do you want to write to?");
                state = 'NO';
                break;
        }
    });
}

main();
