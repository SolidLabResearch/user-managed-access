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
- GET `/uma/policies/<policyId>`: get policy information that you are authorized to see, for the policy with the requested [URL encoded](#uri-encodig-decision) ID.

The current algorithm will retrieve the IDs of the policies and its rules that you are authorized to see. It will seek information about those properties with **depth 1**. This is not representative for a lot of policies, hence a recursive algorithm will be implemented in the future. The procedures will only display information within the scope of the client. This means that other clients' rules and their definition in the policy quads will not be displayed.

### Updating policies
Updating a policy can be done through a PUT or a PATCH request. Both requests have different implementations. Both requests are sent to endpoint `/uma/policies/<policyId>`

#### PUT
A PUT request to the policy endpoint will redefine the entire policy to the requested body, whithin the reach of the client. The PUT works as a combination of DELETE and POST. It requires a body with the same content type as the [POST request](#creating-policies). This body will be interpreted as a policy with some rules. It executes the same sanitization checks as the POST request. Extra checks are implemented to make sure the new policy does not alter out of scope quads. After that, every rule within our reach (and possibly the entire policy) will be deleted. Upon success, the new policy and rule definitions will be added to the storage. When this addition fails, the procedure tries to restore the old policy. In this case, an internal server error will indicate that the patch failed. When the restore could not be completed, the internal server error will indicate that the policy with `<policyId>` has been removed as if a DELETE request was sent.

#### PATCH
A PATCH request to the policy endpoint will update the requested policy. The request expects a body with content type [`application/sparql-query`](https://www.w3.org/TR/rdf-sparql-query/). The INSERT and DELETE properties can be used to modify the requested policy. The PATCH request will get the existing information about the policy, and it will execute the query in an isolated environment. This environment is a store that contains only the relevant quads whithin the scope of the client. This means that a quad  `<policy> <relation> <rule> .` will not be a part of the environment if the rule has not been assigned by the client. Quads that are part of a rule not assigned by the client will also not be a part of the environment. This means that, after executing the query, we can analyse it as desired: we can check that no quads out of scope are added. Only in that case, the update will proceed. The procedure deletes the old policy and replaces it with the updated version, since no better way to update the storage exists. Note that we 

### Deleting policies
To delete a policy, send a DELETE request to `/uma/policies/<policyId>` with the URL encoded ID of the policy. The DELETE works like this:
1. Find the rules defined in the policy
2. Filter the rules that are assigned by the client, and delete them
3. Find out if there are rules not assigned by the client
    * if there are other rules, we cannot delete the policy information as well
    * if there are no other rules, we can delete the entire policy
This method has one rather significant issue. When a client wishes to delete a policy, but other clients are still part of it, we will only remove the rules of the client whithin the policy. We will not remove the definitions of those rules in the policy itself, because there is currently no way to do this. A way to deal with this could be updating the store using dedicated DELETE sparql queries, or by introducing a variant of the storage.deleteRule.


## Implementation details

#### Authorization/Authentication decisions
The current implementation has insufficient authentication restrictions. Currently, the only requirement is that the 'Authorization' header is to be set to the webID of the "logged on" client. Proper procedures to authenticate this client are still to be implemented.

#### Sanitization decisions
Some endpoints allow new policies to be created, or existing policies to be modified. This introduces the possibility of invalid syntactic or semantic policies, hence a sanitization strategy is required. In the current implementation, only POST could introduce such problems. We provided the following basic checks:
- Every defined rule must have a unique ID.
- Every rule must have exactly one assigner.
- Every assigner must match the authenticated client.

Sanitization Limitations
- It is possible to `POST` a policy with an ID that already exists, or with rules that reuse already existing IDs.
- There are currently no checks to verify whether a client is sufficiently authorized to create or modify a policy/rule for a specific target.
    * A client should not be in able to alter rights about a target it does not have access to.
- There are plenty of other sanitization checks to be considered. 

#### URI encodig decision
Some operations require the client to specify a policy ID in the URL. Since policy ID's might contain reserved characters (e.g. `/`, `:`, ...), we have chosen to encode them with the builtin [`encodeURIComponent()` function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent). Using this method, reserved characters will be converted to their respective UTF-8 encodings.

## Testing
The current implementation is tested only by the script in `scripts\test-uma-ODRL-policy.ts`. This script tests every implemented endpoint with a designated flow. Since the script initiates with an empty storage, and there is no endpoint or other way to seed it, the first requests must test the POST endpoint. These tests are designed to ensure that the storage is filled. After the POST tests, the access endpoints can be tested. 

## Problems
- When you have a policy with multiple rules that have different assigners, DELETE on every rule of one assigner will succesfully delete the rule itself, but not the definition of the rule within the policy. This is due to the fact that you can currently only DELETE based on the ID of the rule/policy you want to delete, and you cannot delete the entire policy since other assigners depend on it. Currently, the only problem with this is filling space, since the quads defining deleted rules will not be returned in GET requests.


### Solved Problems

#### PATCH fix
Because PATCH currently works with sets, it contains a safety hazard. When client A has a certain policy/rule, or even just a certain quad, this can be discovered by an intrusive client B. Client B can simply PATCH an INSERT of a random quad that does NOT belong to its own rules/policies, which can have one of three outcomes:
1. The PATCH resolves in an error saying that you cannot change rules that do not belong to you. This means that client A does not have this quad, since a modification was detected.
2. The PATCH resolves in an error saying that you cannot change rules that belong to nobody. This means that the quad is not affiliated with any client.
3. The PATCH completes with code 200. Since the inserted quad does NOT belong to you, there must be another client that owns the quad. In this way, any policy can be discovered.
An extra constraint, disabling clients to PATCH policies it has no rules in, would still enable the client to exploit policies that it has rules in. 

This problem was solved by splitting the policy into the parts where the client has access to, and the parts where it does not. By executing the query only on the parts that the client has access to, it would be easier to analyse the resulting store of the query. If this store has rules that the client does not have access to, they must have been added by the client and the operation gets cancelled. This method is also protected from deleting rules out of our reach.