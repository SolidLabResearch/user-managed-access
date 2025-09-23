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
Bad requests, possibly due to an improper policy definition, will respond with **status code 400 or 409**.
When the policy has been validated, but adding it to the storage fails, the response will have **status code 500**.

#### Example POST Request

This example creates a policy `http://example.org/policy` for client `https://pod.example.com/profile/card#me:`

```curl
curl --location 'http://localhost:4000/uma/policies' \
--header 'Authorization: https://pod.example.com/profile/card#me' \
--header 'Content-Type: text/turtle' \
--data-raw '@prefix ex: <http://example.org/>.
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix dct: <http://purl.org/dc/terms/>.

ex:policy a odrl:Agreement ;
               odrl:uid ex:policy ;
               odrl:permission ex:permission .
ex:permission a odrl:Permission ;
              odrl:action odrl:read ;
              odrl:target <http://localhost:3000/alice/other/resource.txt> ;
              odrl:assignee <https://example.pod.knows.idlab.ugent.be/profile/card#me> ;
              odrl:assigner <https://pod.example.com/profile/card#me> .'
```

### Reading policies

To read policies, two endpoints are implemented:

- GET `/uma/policies`: get policy information you are authorized to see, for every policy.
- GET `/uma/policies/<encodedPolicyID>`: get policy information you are authorized to see, for the policy with the specified [URI encoded](#uri-encoding-decision) ID.

These endpoints returen both the policies (and related rules) where the user is identified as the assigner and assignee.
Applications should be aware of this and should make sure the distinction is made where necessary.

#### GET one policy

An example request to get policy `http://example.org/policy` for the client with webID `https://pod.example.com/profile/card#me` looks like this:

```curl
curl --location 'http://localhost:4000/uma/policies/http%3A%2F%2Fexample.org%2Fpolicy' \
--header 'Authorization: https://pod.example.com/profile/card#me'
```

If the client has viable information about this policy, the server would respond with the information about the policy:

```ttl
<http://example.org/policy> a <http://www.w3.org/ns/odrl/2/Agreement>;
    <http://www.w3.org/ns/odrl/2/permission> <http://example.org/permission>.
<http://example.org/permission> a <http://www.w3.org/ns/odrl/2/Permission>;
    <http://www.w3.org/ns/odrl/2/action> <http://www.w3.org/ns/odrl/2/read>;
    <http://www.w3.org/ns/odrl/2/target> <http://localhost:3000/alice/other/resource.txt>;
    <http://www.w3.org/ns/odrl/2/assignee> <https://example.pod.knows.idlab.ugent.be/profile/card#me>;
    <http://www.w3.org/ns/odrl/2/assigner> <https://pod.example.com/profile/card#me>.
```

#### GET all polices

An example request would look like this:

```curl
curl --location 'http://localhost:4000/uma/policies' \
--header 'Authorization: https://pod.example.com/profile/card#me'
```

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

4. Add the new policy. On success, the server will respond with **status code 204** .
Upon failure, the server will respond with a 5xx error status.

##### Example PUT Request

This example updates the policy previously created, `http://example.org/policy`, by the client `https://pod.example.com/profile/card#me`.

```curl
curl -X PUT --location 'http://localhost:4000/uma/policies/http%3A%2F%2Fexample.org%2Fpolicy' \
--header 'Authorization: https://pod.example.com/profile/card#me' \
--header 'Content-Type: text/turtle' \
--data-raw '@prefix ex: <http://example.org/>.
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .
@prefix dct: <http://purl.org/dc/terms/>.

ex:policy a odrl:Agreement ;
              odrl:permission ex:permission ;
              odrl:uid ex:policy .
ex:permission a odrl:Permission ;
              odrl:action odrl:read ;
              odrl:target <http://localhost:3000/alice/other/new_resource.txt> ;
              odrl:assignee <https://example.pod.knows.idlab.ugent.be/profile/card#me> ;
              odrl:assigner <https://pod.example.com/profile/card#me> .'
```

This example updates the target of this policy. It is important to explicitly include `-X PUT`, as curl will otherwise default to a POST request, which is invalid for this endpoint.

#### PATCH

A PATCH request will update the policy and its related rules using a SPARQL update query.
The `content-type` header must be set to `application/sparql-update`.

The policy will be isolated from the store before executing the query, to make sure no other quads are affected.
In addition, the user's credentials are checked to make sure they are the resource owner for the resource targeted in the policy.
After this, the query can be executed.
To make sure the policy remains a valid policy, the policy is isolated and checked again before inserting the modified store back in the store.

##### Example PATCH request

The example below illustrates how policies can be changed using a PATCH request. We notice that the content type has changed to `application/sparql-query`.

```curl
curl -X PATCH --location 'http://localhost:4000/uma/policies/http%3A%2F%2Fexample.org%2Fpolicy' \
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
The deletion is handled by performing a simple `DELETE WHERE` SPARQL query.

#### Example DELETE Request

In order to delete the policy created and updated above, this simple request would do the job:

```curl
curl -X DELETE --location 'http://localhost:4000/uma/policies/http%3A%2F%2Fexample.org%2Fpolicy' \
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
    - A client should not be in able to alter rights about a target it does not have access to.
- There are plenty of other sanitization checks to be considered.

### URI encoding decision

Some operations require the client to specify a policy ID in the URL. Since policy ID's might contain reserved characters (e.g. `/`, `:`, ...), we have chosen to encode them with the builtin [`encodeURIComponent()` function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent). Using this method, reserved characters will be converted to their respective UTF-8 encodings.

## Testing

The current implementation is tested only by the script in `scripts\test-uma-ODRL-policy.ts`. This script tests every implemented endpoint with a designated flow. Since the script initiates with an empty storage, and there is no endpoint or other way to seed it, the first requests must test the POST endpoint. These tests are designed to ensure that the storage is filled. After the POST tests, the access endpoints can be tested. Every endpoint gets tested in this script, which makes sure that the added data is removed. The current testing will be replaced with proper unit tests and integration tests in the near future.

## TODO

- The current [sanitization limitations](#sanitization-decisions) are to be considered.
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
