import logger from './util/logger';
import * as readline from 'readline/promises';
import { UserManagedAccessFetcher } from './util/UMA-client';
import { SETUP_POLICIES } from './util/policy-access-request-integration-util';
import { parseStringAsN3Store } from 'koreografeye';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000/uma';
const POLICY_URL = `${BASE_URL}/policies`;

const RESOURCE_OWNER = process.env.RESOURCE_OWNER || 'https://resource-owner.solidweb.org/profile/card#me';
const REQUESTING_PARTY = process.env.REQUESTING_PARTY || 'https://requesting-party.solidweb.org/profile/card#me';
const claim_token_format = 'urn:solidlab:uma:claims:formats:webid';

const RESOURCE = process.env.RESOURCE_URL || 'http://localhost:3000/resources/resource.txt';
const POLICY = process.env.POLICY_URL || 'http://example.org/policy';
const CONTENT = "hello world";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const getResourceInformation = async (): Promise<{ policy: string, parent: string, resource: string, readOrWrite: string }> => {
    const readOrWrite = await rl.question('Do you wish to read or write? (leave empty for read): ') || 'read';
    const input = await rl.question('Please enter resource (leave empty for default): ') || RESOURCE;
    const policy = await rl.question('Please enter the policy ID of the linking policy (leave empty for default): ') || POLICY;

    try {
        const url = new URL(input);
        const pathSegments = url.pathname.split('/');
        const lastSegment = pathSegments[pathSegments.length - 1];

        if (lastSegment === '') {
            return {
                policy: policy,
                parent: input,
                resource: '',
                readOrWrite: readOrWrite
            };
        } else {
            const parentSegments = pathSegments.slice(0, -1).join('/');
            const parentURL = `${new URL(parentSegments, url.origin).href}/`;

            return {
                policy: policy,
                parent: parentURL,
                resource: input,
                readOrWrite: readOrWrite
            };
        }
    } catch (error: any) {
        logger.error(`invalid URL provided: ${input} (${error.message})`);
        return {
            policy: policy,
            parent: '',
            resource: '',
            readOrWrite: readOrWrite
        };
    } finally {
        rl.close();
    }
}

const setup = async (input: { parent: string, resource: string }): Promise<void> => {
    const { parent, resource } = input;

    const response = await fetch(
        POLICY_URL, {
            method: 'POST',
            headers: {
                'authorization': RESOURCE_OWNER,
                'content-type': 'text/turtle'
            }, body: SETUP_POLICIES(parent, resource, RESOURCE_OWNER)
        }
    );

    if (response.status !== 201) {
        logger.error(`failed to setup necessary policies: ${response.statusText}`);
        return ;
    }

    const umaResponse = await new UserManagedAccessFetcher({
        token: RESOURCE_OWNER,
        token_format: claim_token_format
    }).fetch(resource, {
        method: 'PUT',
        body: CONTENT
    });

    if (umaResponse.status === 403) {
        logger.error(`failed to PUT content in policies: ${response.statusText}`);
        return ;
    }
}

const teardown = async (policy: string): Promise<void> => {
    const policies = await fetch(
        POLICY_URL, {
            method: 'GET',
            headers: {
                'authorization': RESOURCE_OWNER
            }
        }
    );

    const store = await parseStringAsN3Store(await policies.text());
    const policyIDs = store.getSubjects(null, "http://www.w3.org/ns/odrl/2/Agreement", null).filter((subject) => subject.id !== policy).map((subject) => subject.id);
    
    await Promise.all(policyIDs.map((policyID) =>
        fetch(`${POLICY_URL}/${encodeURIComponent(policyID)}`, { method: 'DELETE', headers: { 'authorization': RESOURCE_OWNER } })
    ));
}

const writeResource = async (resource: string, client: string): Promise<string> => {
    const response = await new UserManagedAccessFetcher({
        token: client,
        token_format: claim_token_format
    }).fetch(resource, {
        method: 'PUT',
        body: CONTENT.toUpperCase()
    });

    if (Math.floor(response.status / 100) !== 2) {
        logger.error('failed to write content');
        return '';
    }

    return readResource(resource, client);
}

const readResource = async (resource: string, client: string): Promise<string> => {
    const response = await new UserManagedAccessFetcher({
        token: client,
        token_format: claim_token_format
    }).fetch(resource);

    if (response.status !== 200) {
        logger.error(`failed to read content: ${response.statusText}`);
        return '';
    }

    return response.text();
}

const main = async (): Promise<void> => {
    const { policy, parent, resource, readOrWrite } = await getResourceInformation();

    logger.info('starting setup...');
    await setup({ parent, resource });

    let content: string | undefined = undefined;

    if (readOrWrite === 'read') {
        logger.info(`setup complete, attempting to read ${resource} from requesting party`);
        content = await readResource(resource, REQUESTING_PARTY);
    } else if (readOrWrite === 'write') {
        logger.info(`setup complete, attempting to write ${resource} from requesting party`);
        content = (await writeResource(resource, REQUESTING_PARTY)).toLowerCase();
    }

    if (CONTENT === content) logger.info(`received expected content: ${content}`);
    else logger.error(`expected '${CONTENT}', but got '${content}'`);

    logger.info('starting teardown...');
    await teardown(policy);
}

main();
