import path from "path";
import { DirectoryUCRulesStorage } from "../packages/ucp/src/storage/DirectoryUCRulesStorage"
import { PolicyRequestHandler } from "../packages/uma/src/routes/Policy"
import { HttpHandlerContext } from "../packages/uma/src/util/http/models/HttpHandler";

const client1 = 'https://pod.woutslabbinck.com/profile/card#me';
const client2 = 'https://pod.example.com/profile/card#me';
const policyStorePath = path.join(__dirname, '..', 'packages', 'uma', 'config', 'rules', 'test');


async function main() {
    console.log(`Primitive unit test to check policy access based on the client\n`);

    // This test uses the existing test.ttl policy directory as the store, could be any other store
    const store = new DirectoryUCRulesStorage(policyStorePath);

    const handler = new PolicyRequestHandler(store);

    let response = await handler.handle({ request: { body: client1 } } as HttpHandlerContext)

    console.log("expecting usagePolicy1, usagePolicy2a and usagePolicy3", response.body)

    response = await handler.handle({ request: { body: client2 } } as HttpHandlerContext)

    console.log("expecting usagePolicy1a and usagePolicy2", response.body)
}
main()
