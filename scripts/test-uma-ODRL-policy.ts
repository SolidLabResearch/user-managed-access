import path from "path";
import { DirectoryUCRulesStorage } from "../packages/ucp/src/storage/DirectoryUCRulesStorage"
import { PolicyRequestHandler } from "../packages/uma/src/routes/Policy"

const endpoint = 'http://localhost:3000/policies'
const client1 = 'https://pod.woutslabbinck.com/profile/card#me';
const client2 = 'https://pod.example.com/profile/card#me';
const policyStorePath = path.join(__dirname, '..', 'packages', 'uma', 'config', 'rules', 'test');


async function main() {
    console.log(`Primitive unit test to check policy access based on the client\n`);

    // This test uses the existing test.ttl policy directory as the store, could be any other store
    const store = new DirectoryUCRulesStorage(policyStorePath);

    const handler = new PolicyRequestHandler(store);

    let response = await fetch(endpoint, { headers: { 'Authorization': client1 } })

    console.log("expecting usagePolicy1, usagePolicy2a and usagePolicy3", response.body)

    response = await fetch(endpoint, { headers: { 'Authorization': client2 } })

    console.log("expecting usagePolicy1a and usagePolicy2", response.body)
}
main()
