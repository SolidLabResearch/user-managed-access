/**
 * The purpose of this script is to test all policy and access requests endpoints.
 * 
 * This integration tests test the following scenarios:
 * 
 * 1. RP requests access to resource, RO accepts
 * 2. RP requests access to resource, RO denies
 * 3. RP requests access to resource, tries to make its own accept
 */

import { parseStringAsN3Store } from 'koreografeye';
import logger from './util/logger';
import { ACCESS_REQUEST, accessRequestID, SETUP_POLICIES } from './util/policy-access-request-integration-util';
import { UserManagedAccessFetcher } from './util/UMA-client';

// --- Testing configurations ---

const REQUESTING_PARTY = "https://example.org/pods/requesting-party/profile/card#me";
const RESOURCE_OWNER = "https://example.org/pods/resource-owner/profile/card#me";
const RESOURCE_PARENT = "http://localhost:3000/alice/other/";
const RESOURCE = `${RESOURCE_PARENT}resource.txt`

const BASE_URL = "http://localhost:4000/uma";
const POLICY_URL = `${BASE_URL}/policies`;
const ACCESS_REQUEST_URL = `${BASE_URL}/requests`;

const claim_token_format = 'urn:solidlab:uma:claims:formats:webid';
const CONTENT = "some text";

// --- Testing types and basic success/failure functions ---

type Result = 
    | { status: 'Ok' }
    | { status: 'Err'; error: string };

const success = async (): Promise<Result> => ({ status: 'Ok' });
const fail = async (reason?: string): Promise<Result> => ({ status: 'Err', error: reason || 'fail' });

// --- Setup and teardown functionality ---

const setup = async (): Promise<Result> => {
    const response = await fetch(
        POLICY_URL, {
            method: 'POST',
            headers: {
                'authorization': RESOURCE_OWNER,
                'content-type': 'text/turtle'
            }, body: SETUP_POLICIES(RESOURCE_PARENT, RESOURCE, RESOURCE_OWNER)
        }
    );

    const umaClientResponse = await new UserManagedAccessFetcher({
        token: RESOURCE_OWNER,
        token_format: claim_token_format
    }).fetch(RESOURCE, {
        method: 'PUT',
        body: CONTENT
    });

    if (response.status === 201 && umaClientResponse.status !== 403) return success();
    else throw await fail(`failed to setup: ${response.status}`);
};

const teardown = async (): Promise<Result> => {
    const policies = await fetch(
        POLICY_URL, {
            method: 'GET',
            headers: {
                'authorization': RESOURCE_OWNER
            }
        }
    );

    const store = await parseStringAsN3Store(await policies.text());
    const policyIDs = store.getSubjects(null, "http://www.w3.org/ns/odrl/2/Agreement", null).map((subject) => subject.id);
    
    await Promise.all(policyIDs.map((policyID) =>
        fetch(`${POLICY_URL}/${encodeURIComponent(policyID)}`, { method: 'DELETE', headers: { 'authorization': RESOURCE_OWNER } })
    ));

    return success();
};

const sleep = async (ms: number): Promise<void> =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

// --- Testing helper functions ---

const createAccessRequest = async (clientID: string): Promise<Result> => {
    const response = await fetch(
        ACCESS_REQUEST_URL, {
            method: 'POST',
            headers: {
                'authorization': clientID,
                'content-type': 'text/turtle'
            }, body: ACCESS_REQUEST(RESOURCE, clientID),
        }
    );

    if (response.status === 201) return success();
    else throw await fail(`failed to create access request: ${response.status}`);
};

const updateAccessRequest = async (clientID: string, status: 'accepted' | 'denied'): Promise<Result> => {
    const response = await fetch(
        `${ACCESS_REQUEST_URL}/${encodeURIComponent(accessRequestID)}`, {
            method: 'PATCH',
            headers: {
                'authorization': clientID,
                'content-type': 'application/json'
            }, body: JSON.stringify({ status: status })
        }
    );

    if (response.status === 204) return success();
    else throw await fail(`failed to update request status tp ${status}: ${response.status}`);
};

const acceptAccessRequest = async (clientID: string): Promise<Result> => updateAccessRequest(clientID, 'accepted');
const denyAccessRequest = async (clientID: string): Promise<Result> => updateAccessRequest(clientID, 'denied');

const deleteAccesRequest = async (clientID: string): Promise<Result> => {
    const response = await fetch(
        `${ACCESS_REQUEST_URL}/${encodeURIComponent(accessRequestID)}`, {
            method: 'DELETE',
            headers: {
                'authorization': clientID
            }
        }
    );

    if (response.status === 204) return success();
    else throw await fail(`failed to delete access request: ${response.status}`);
};

const readResource = async (clientID: string): Promise<Result> => {
    const response = await new UserManagedAccessFetcher({
        token: clientID,
        token_format: claim_token_format
    }).fetch(RESOURCE);

    if (response.status === 200) return success();
    else throw await fail(`failed to read resource succesfully`);
};

// --- Define tests ----

const first = async (): Promise<Result> => {
    await setup();

    try {
        await createAccessRequest(REQUESTING_PARTY);
        await acceptAccessRequest(RESOURCE_OWNER);
        await readResource(REQUESTING_PARTY);
        await deleteAccesRequest(RESOURCE_OWNER);
    } catch (failed) {
        return fail(failed.error);
    }

    await teardown();
    return success();
}

const second = async (): Promise<Result> => {
    await setup();

    try {
        await createAccessRequest(REQUESTING_PARTY);
        await denyAccessRequest(RESOURCE_OWNER);
    } catch (failed) {
        return fail(failed.error);
    }

    try {
        if (await readResource(REQUESTING_PARTY) === await success())
            return fail(`should not be able to read the resource!`);
    } catch (_failed) {
        // this should fail and throw
    }

    try {
        await deleteAccesRequest(RESOURCE_OWNER);
    } catch (failed) {
        return fail(failed.error);
    }

    await teardown();
    return success();
};

const third = async (): Promise<Result> => {
    await setup();

    try {
        await createAccessRequest(REQUESTING_PARTY);
    } catch (failed) {
        return fail(failed.error);
    }

    try {
        if (await success() === await acceptAccessRequest(REQUESTING_PARTY))
            return fail(`should not be able to allow access`);
    } catch (_failed) {
        // this should fail and throw
    }

    try {
        await deleteAccesRequest(RESOURCE_OWNER);
    } catch (failed) {
        return fail(failed.error);
    }

    await teardown();
    return success();
};

// --- Register tests ---

const tests: Map<string, () => Promise<Result>> = new Map([
    ["first scenario", first],
    ["second scenario", second],
    ["third scenario", third],
]);

async function main() {
    logger.info(`testing policy and access requests endpoints`);

    const start = Date.now();

    const entries = Array.from(tests.entries());
    const total = entries.length;

    for (const [index, [name, test]] of entries.entries()) {
        const result = await test();
        if (result.status === 'Err')
            logger.error(`test "${name}" (${index + 1}/${total}) failed: ${result.error}`);
        else logger.info(`test "${name}" (${index + 1}/${total}) succeeded`);
    }

    const end = Date.now();
    const durationMillis = end - start;
    const durationSeconds = (durationMillis/1000).toFixed(2);
    
    logger.info(`all tests completed in ${durationSeconds}s`);
}

main();
