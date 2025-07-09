# Policy Management
In this document we describe the *policy adminstration endpoint*.
It contains the methods to describe how to create, read, update and delete policies

## Supported endpoints
The current implementation supports `GET` and `POST` requests, which comply with some restrictions:
- The request has its `'Authorization'` header set to the clients webID. More on that [later](#authorizationauthentication-decisions)
- The requests as discussed in this document use the same base URL: `/uma/policies`

### Creating policies
Create a policy/multiple policies through a POST request to `/uma/policies`. Apart from its Authorization header, the `'Content-Type'` must be set to the RDF serialization format in which the body is written. The accepted formats are those accepted by the [N3 Parser](https://github.com/rdfjs/N3.js/?tab=readme-ov-file#parsing).

The body is expected to represent a proper ODRL policy, although some [sanitization](#sanitization-decisions) is applied to ensure minimal validity. 

### Reading policies
To read policies, two endpoints are implemented:
- GET `/uma/policies`: get policy information that you are authorized to see, for every policy
- GET `/uma/policies/<id>`: get policy information that you are authorized to see, for the policy with the requested [URL encoded](#uri-encodig-decision) ID.

The current algorithm will retrieve the IDs of the policies and its rules that you are authorized to see. It will seek information about those properties with **depth 1**. This is not representative for a lot of policies, hence a recursive algorithm will be implemented in the future.

### Updating policies
Yet to be implemented...

### Deleting policies
To delete a policy, send a DELETE request to `/uma/policies/<id>` with the URL encoded ID of the policy. The DELETE works like this:
1. Find the rules defined in the policy
2. Filter the rules that are assigned by the client, and delete them
3. Find out if there are rules not assigned by the client
    * if there are other rules, we cannot delete the policy information as well
    * if there are no other rules, we can delete the entire policy

extra info

#### Authorization/Authentication decisions
The current implementation has insufficient authentication restrictions. Currently, the only requirement is that the 'Authorization' header is to be set to the webID of the "logged on" client. Proper procedures to authenticate this client are still to be implemented.

#### Sanitization decisions
Some endpoints allow new policies to be created, or existing policies to be modified. This introduces the possibility of invalid syntactic or semantic policies, hence a sanitization strategy is required. In the current implementation, only POST could introduce such problems. We provided the following basic checks:
- Every defined rule must have a unique ID
- Every rule must have exactly one assigner
- Every assigner must match the authenticated client

Sanitization Limitations
- It is possible to `POST` a policy with an ID that already exists, or with rules that reuse already existing IDs
- There are currently no checks to verify whether a client is sufficiently authorized to create or modify a policy/rule for a specific target.
    * A client should not be in able to alter rights about a target it does not have access to
- There are plenty of other sanitization checks to be considered. 

#### URI encodig decision
Some operations require the client to specify a policy ID in the URL. Since policy ID's might contain reserved characters (e.g. `/`, `:`, ...), we have chosen to encode them with the builtin [`encodeURIComponent()` function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent). Using this method, reserved characters will be converted to their respective UTF-8 encodings.

## Testing
The current implementation is tested only by the script in `scripts\test-uma-ODRL-policy.ts`. This script tests every implemented endpoint with a designated flow. Since the script initiates with an empty storage, and there is no endpoint or other way to seed it, the first requests must test the POST endpoint. These tests are designed to ensure that the storage is filled. After the POST tests, the access endpoints can be tested. 