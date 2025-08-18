# Policy Management

In this document we describe the *policy adminstration endpoint*.
It contains the methods to describe how to create, read, update and delete policies.

## Supported endpoints

The current implementation supports the following requests:

- [`GET`](#reading-policies) to both `uma/policies` and `uma/policies/<encodedPolicyID>`
- [`POST`](#creating-policies) to `uma/policies`
- [`PATCH`](#updating-policies) to `uma/policies/<encodedPolicyID>`
- [`PUT`](#updating-policies) to `uma/policies/<encodedPolicyID>`
- [`DELETE`](#deleting-policies) to `uma/policies/<encodedPolicyID>`

These requests comply with some restrictions:

- When the URL contains a policy ID, it must be [URI encoded](#uri-encoding-decision).
- The request must have its `'Authorization'` header set to the clients webID. More on that [later](#authorizationauthentication-decisions).

### Creating policies

Create a policy/multiple policies through a POST request to `/uma/policies`.
Apart from its Authorization header, the `'Content-Type'` must be set to the RDF serialization format in which the body is written.
The accepted formats are those accepted by the [N3 Parser](https://github.com/rdfjs/N3.js/?tab=readme-ov-file#parsing), represented by the following content types:

- `text/turtle`
- `application/trig`
- `application/n-triples`
- `application/n-quads`
- `text/n3`

The body is expected to represent a valid ODRL policy, although some [sanitization](#sanitization-decisions) is applied to ensure minimal validity. It is possible to POST multiple policies at once, but they have to remain in scope of the client.
Upon success, the server responds with **status code 201**.
Bad requests, possibly due to an improper policy definition, will respond with **status code 400**.
When the policy has been validated, but adding it to the storage fails, the response will have **status code 500**.

#### Example POST Request

This example creates a policy `http://example.org/usagePolicy` for client `https://pod.example.com/profile/card#me:`

```curl
curl --location 'http://localhost:4000/uma/policies' \
--header 'Authorization: https://pod.example.com/profile/card#me' \
--header 'Content-Type: text/turtle' \
--data-raw '@prefix ex: <http://example.org/>.
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix dct: <http://purl.org/dc/terms/>.

ex:usagePolicy a odrl:Agreement .
ex:usagePolicy odrl:permission ex:permission .
ex:permission a odrl:Permission .
ex:permission odrl:action odrl:read .
ex:permission odrl:target <http://localhost:3000/alice/other/resource.txt> .
ex:permission odrl:assignee <https://example.pod.knows.idlab.ugent.be/profile/card#me> .
ex:permission odrl:assigner <https://pod.example.com/profile/card#me> .'
```

### Reading policies

To read policies, two endpoints are implemented:

- GET `/uma/policies`: get policy information you are authorized to see, for every policy.
- GET `/uma/policies/<encodedPolicyID>`: get policy information you are authorized to see, for the policy with the specified [URI encoded](#uri-encoding-decision) ID.

#### GET one policy

The algorithm to GET a single policy will use a procedure to separate the policy into different parts:

1. Policy Quads
    - Some quads in the policy define rules. Their general form looks like `<policyID> <relation> <ruleID> .`. These quads are split into rules owned by the client **(1)**, and those owned by another client **(2)**.
    - Other quads define other parts about the policy. These quads are set into a group of `policy definitions` **(3)**.
2. Rule Quads
    - Owned rule quads are those where the client as an assigner **(4)**.
    - Other rule quads are owned by other clients **(5)**.

The procedure returns an object containing these five groups. Note that the information is discovered through a **depth 1** algorithm, which can not handle `Duty` constructions.
The same procedure is also used in other endpoints, in cases where it is also important what groups **(2)** and **(5)** contain, which is why we also return these.

The GET endpoint for one policy will call this procedure, processes groups **(1)**, **(3)** and **(4)**.
If group **(1)** is not empty, it will respond with **status code 200** and returns the information in the body with `Content-type: text/turtle`.
If group **(1)** is empty, it will respond with **status code 204** and an empty body.

An example request to get policy `http://example.org/usagePolicy` for the client with webID `https://pod.example.com/profile/card#me` looks like this:

```curl
curl --location 'http://localhost:4000/uma/policies/http%3A%2F%2Fexample.org%2FusagePolicy' \
--header 'Authorization: https://pod.example.com/profile/card#me'
```

If the client has viable information about this policy, the server would respond with the information about the policy:

```curl
<http://example.org/usagePolicy> a <http://www.w3.org/ns/odrl/2/Agreement>;
    <http://www.w3.org/ns/odrl/2/permission> <http://example.org/permission>.
<http://example.org/permission> a <http://www.w3.org/ns/odrl/2/Permission>;
    <http://www.w3.org/ns/odrl/2/action> <http://www.w3.org/ns/odrl/2/read>;
    <http://www.w3.org/ns/odrl/2/target> <http://localhost:3000/alice/other/resource.txt>;
    <http://www.w3.org/ns/odrl/2/assignee> <https://example.pod.knows.idlab.ugent.be/profile/card#me>;
    <http://www.w3.org/ns/odrl/2/assigner> <https://pod.example.com/profile/card#me>.
```

#### GET all polices

The current implementation iterates over every quad in the policy that defines a rule, performing a lookup to see if the client is the assigner.
Only then, additional information about the policy AND the rule will be collected, once again only with **depth 1**. The information about the policy will be filtered, because you shouldn't be in able to see the rule definitions of another client.

This is not done with the procedure from the GET One Policy endpoint, because using it over every policy would be quite exhaustive.

An example request would look like this:

```curl
curl --location 'http://localhost:4000/uma/policies' \
--header 'Authorization: https://pod.example.com/profile/card#me'
```

The response is similar to the GET One Policy response, but for every policy *owned* by the client.

### Updating policies

Updating a policy can be done through a PUT or a PATCH request to `/uma/policies/<encodedPolicyID>`, each with different semantics.

#### PUT

A PUT completely replaces the policy within the scope of the client.
The PUT works as a combination of DELETE and POST. It requires a body with the same content type as the [POST request](#creating-policies). This body will be interpreted as the requested policy with some rules.

The PUT process:

1. Find information about the policy. If it does not exist, return with a **status code 404** to indicate that you cannot rewrite a nonexistent policy.

2. Parse and validate the body, with the same procedure used in the POST endpoint. First, we perform the basic sanitization checks. Upon success, extra checks are performed to see if the new definition stays within the scope of the client:
     - Check that the newly defined policy does not define other policies
     - Check that the new policy does not contain any rules that do not belong to the client
     - Check that no unrelated quads to the policy and its rules are added.

    Failed checks will result in a response with **status code 400** and a dedicated message.
3. Delete the old policy, but keep a copy for a possible rollback. The deletion uses the procedure used in the [DELETE](#deleting-policies) endpoint.

4. Add the new policy. On success, the server will respond with **status code 200** and a body containing the new policy and its rules (within scope of the client). When this does not succeed, a rollback will be set up:
    - The server will try to reset the state of the policy by adding the old quads. If this succeeds, an internal server error with **status code 500** will indicate that nothing has been rewritten, and the old version is restored.
    - When the rollback fails, we basically deleted the policy information within our reach. An internal server error with **status code 500** will indicate this.

Note that this endpoint uses the POST and DELETE functionality to implement the PUT.

##### Example PUT Request

This example updates the policy previously created, `http://example.org/usagePolicy`, by the client `https://pod.example.com/profile/card#me`.

```curl
curl -X PUT --location 'http://localhost:4000/uma/policies/http%3A%2F%2Fexample.org%2FusagePolicy' \
--header 'Authorization: https://pod.example.com/profile/card#me' \
--header 'Content-Type: text/turtle' \
--data-raw '@prefix ex: <http://example.org/>.
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix dct: <http://purl.org/dc/terms/>.

ex:usagePolicy a odrl:Agreement .
ex:usagePolicy odrl:permission ex:permission .
ex:permission a odrl:Permission .
ex:permission odrl:action odrl:read .
ex:permission odrl:target <http://localhost:3000/alice/other/new_resource.txt> .
ex:permission odrl:assignee <https://example.pod.knows.idlab.ugent.be/profile/card#me> .
ex:permission odrl:assigner <https://pod.example.com/profile/card#me> .'
```

This example updates the target of this policy. It is important to explicitly include `-X PUT`, as curl will otherwise default to a POST request, which is invalid for this endpoint.

#### PATCH

A PATCH request will update the specified policy. The request expects a body with content type [`application/sparql-query`](https://www.w3.org/TR/rdf-sparql-query/). The INSERT and DELETE properties can be used to modify the requested policy. These modifications can only be applied to parts of the policy within the client's scope.

The PATCH process:

1. Collect all information about the existing policy with the procedure explained in the [GET One Policy endpoint](#get-one-policy). If the policy does not exist, the server responds with **status code 400**. In the current implementation, we have chosen that the client cannot PATCH a policy in which it has no rules. Doing so will also result in a response with **status code 400**.

2. The content type of the body gets validated. The content-type must be set to `application/sparql-query`. Any other type will result in a response with **status code 400**.

3. We use the policy information to create a store which only contains groups **(1)**, **(3)** and **(4)** as explained [above](#get-one-policy). This will serve as an isolated store, on which we can execute the update query. This implementation has its advantages:
    - We do not need to validate the sparql query, since we execute it on an isolated store.
    - Performing DELETE queries on rules out of your scope will simply not work, since they are not part of the isolated store.
    - We can easily see exactly when the query goes out of scope by testing the resulting store, separating it in the 5 groups and performing the following checks:
        1. If the resulting store has rules out of the clients' scope (indicated by groups **(2)** and **(5)**), we can abort the update and respond with **status code 400**.
        2. We can analyze the size of the resulting store. Substracting the amount of quads within reach should result in 0, since no other rules may be added. This test will fail when the client inserts/deletes any unrelated quads to its own policy. Upon failure, the server responds with **status code 400**.
4. The old definition will be replaced with the updated version. Since no real update function for our storage exists, we delete the old policy and add the resulting store from the query, together with the quads out of scope as collected in step 1.

Note that any quads in the original policy that could not be collected by the procedure defined in [GET One Policy](#get-one-policy), will not be part of the newly defined policy.

##### Example PATCH request

The example below illustrates how policies can be changed using a PATCH request. We notice that the content type has changed to `application/sparql-query`.

```curl
curl -X PATCH --location 'http://localhost:4000/uma/policies/http%3A%2F%2Fexample.org%2FusagePolicy' \
--header 'Authorization: https://pod.example.com/profile/card#me' \
--header 'Content-Type: application/sparql-update' \
--data-raw 'PREFIX odrl: <http://www.w3.org/ns/odrl/2/>

DELETE {
    ?policy odrl:action odrl:read
} INSERT {
    ?policy odrl:action odrl:write
} WHERE {
    ?policy odrl:target <http://localhost:3000/alice/other/new_resource.txt>
}'
```

### Deleting policies

To delete a policy, send a DELETE request to `/uma/policies/<encodedPolicyID>` with the URI encoded ID of the policy.

The DELETE process:

1. Find the rules defined in the policy.
2. Filter the rules that are assigned by the client, and delete them.
3. Find out if there are rules not assigned by the client.
    - If there are other rules, we cannot delete the policy information as well. We delete the rule and its definition triple in the policy.
    - If there are no other rules, we can delete the entire policy.

This method used to have one rather significant issue, as discussed [later](#delete-fix).

#### Example DELETE Request

In order to delete the policy created and updated above, this simple request would do the job:

```curl
curl -X DELETE --location 'http://localhost:4000/uma/policies/http%3A%2F%2Fexample.org%2FusagePolicy' \
--header 'Authorization: https://pod.example.com/profile/card#me'
```

## Implementation details

### Authorization/Authentication decisions

The current implementation has insufficient authentication restrictions. Currently, the only requirement is that the 'Authorization' header is to be set to the webID of the "logged on" client. Proper procedures to authenticate this client are still to be implemented.

### Sanitization decisions

Some endpoints allow new policies to be created, or existing policies to be modified. This introduces the possibility of invalid syntactic or semantic policies, hence a sanitization strategy is required. In the current implementation, only POST, PUT and PATCH could introduce such problems. We provided the following basic checks:

- Every defined rule must have a unique ID.
- Every rule must have exactly one assigner.
- Every assigner must match the authenticated client.

Sanitization Limitations

- There are currently no checks to verify whether a client is sufficiently authorized to create or modify a policy/rule for a specific target.

    A client should not be in able to alter rights about a target it does not have access to.

    This issue is currently being solved in [a dedicated PR](https://github.com/SolidLabResearch/user-managed-access/pull/50)

- There are plenty of other sanitization checks to be considered.

### URI encoding decision

Some operations require the client to specify a policy ID in the URL. Since policy ID's might contain reserved characters (e.g. `/`, `:`, ...), we have chosen to encode them with the builtin [`encodeURIComponent()` function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent). Using this method, reserved characters will be converted to their respective UTF-8 encodings.

## Testing

The current implementation is tested only by the script in `scripts\test-uma-ODRL-policy.ts`. This script tests every implemented endpoint with a designated flow. Since the script initiates with an empty storage, and there is no endpoint or other way to seed it, the first requests must test the POST endpoint. These tests are designed to ensure that the storage is filled. After the POST tests, the access endpoints can be tested. Every endpoint gets tested in this script, which makes sure that the added data is removed. The current testing will be replaced with proper unit tests and integration tests in the near future.

## TODO

- The current [sanitization limitations](#sanitization-decisions) are to be considered.
- Fix CORS handling: the project configuration must be extended to the `/policies` endpoint.
- Implement Unit Tests
- ...

### Solved Problems

#### DELETE fix

##### Problem

When you have a policy with multiple rules that have different assigners, DELETE on every rule of one assigner will succesfully delete the rule itself, but not the definition of the rule within the policy. This is due to the fact that you can currently only DELETE based on the ID of the rule/policy you want to delete, and you cannot delete the entire policy since other assigners depend on it. Currently, the only problem with this is filling space, since the quads defining deleted rules will not be returned in GET requests.

##### Fix

We created a new RulesStorage function, made specifically to fix our problem entirely. The function is implemented to delete the rule AND its definition in the policy. This solution is still a bit experimental.

#### PATCH fix

PATCH used to contain a safety hazard. When client A has a certain policy/rule, or even just a certain quad, this could be discovered by an intrusive client B. Client B could simply PATCH an INSERT of a random quad that does NOT belong to its own rules/policies, which can have one of three outcomes:

1. The PATCH resolves in an error saying that you cannot change rules that do not belong to you. This means that the quad belongs to some other client, since it has been detected as a quad owned by someone else.

2. The PATCH resolves in an error saying that you cannot change rules that belong to nobody. This means that the quad is not affiliated with any client.

3. The PATCH completes with code 200. Since the inserted quad does NOT belong to you, there must be another client that owns the quad. In this way, any policy can be discovered (exhaustively).
An extra constraint, disabling clients to PATCH policies it has no rules in, would still enable the client to exploit policies that it has rules in.

This problem was solved by splitting the policy into the parts where the client has access to, and the parts where it does not. By executing the query only on the parts that the client has access to, it would be easier to analyse the resulting store of the query. If this store has rules that the client does not have access to, they must have been added by the client and the operation gets cancelled. This method is also protected from deleting rules out of our reach.

#### POST checks

It is now impossible to POST an already existing policy or already existing rules. This means that a policy can only be POSTED once. If a client wishes to be a part of a policy, it has to do it through a PUT request. If a client is already part of the policy, it can PATCH modifications.
