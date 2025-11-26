# Policy Management

The *policy management API* allows users to configure the policies that govern access to their data.
First we cover the available operations, after which we cover the known issues and limitations of the API.

## API

The current implementation supports the following requests on the UMA server:

- [`GET`](#reading-policies) to both `uma/policies` and `uma/policies/<encodedPolicyID>`
- [`POST`](#creating-policies) to `uma/policies`
- [`PATCH`](#updating-policies) to `uma/policies/<encodedPolicyID>`
- [`PUT`](#updating-policies) to `uma/policies/<encodedPolicyID>`
- [`DELETE`](#deleting-policies) to `uma/policies/<encodedPolicyID>`

These requests comply with some restrictions:

- When the URL contains a policy ID, it must be URI encoded.
- Every request requires a valid Authorization header, which is detailed below.

### Authorization

The policy API supports similar authentication tokens as the UMA API,
but expects them in the Authorization header,
as the body is already used for other purposes.
Two authorization methods are supported: OIDC tokens, both Solid and standard, and unsafe WebID strings.

To use OIDC, the `Bearer` authorization scheme needs to be used, followed by the token.
For example, `Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI...`.

To directly pass a WebID, the `WebID` scheme can be used together with a URL encoded WebID.
For example, `Authorization: WebID http%3A%2F%2Fexample.com%2Fprofile%2Fcard%23me`.
No validation is performed in this case, so this should only be used for development and debugging purposes.

### Creating policies

Create a policy/multiple policies through a POST request to `/uma/policies`.
Apart from its Authorization header, the `'Content-Type'` must be set
to the RDF serialization format in which the body is written.
The accepted formats are those accepted by the [N3 Parser](https://github.com/rdfjs/N3.js/?tab=readme-ov-file#parsing), represented by the following content types:

- `text/turtle`
- `application/trig`
- `application/n-triples`
- `application/n-quads`
- `text/n3`

The body is expected to represent a valid ODRL policy,
although some [sanitization](#sanitization-decisions) is applied to ensure minimal validity.
It is possible to POST multiple policies at once, but they have to remain in scope of the owner.
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

- GET `/uma/policies`: return all policies the provided credentials have assigned.
- GET `/uma/policies/<encodedPolicyID>`: return the rules of the policy with the given (encoded) ID,
  if the provided credentials are allowed to see them.

One policy can contain rules of multiple assigners,
only the rules where the assigner matches the request credentials will be returned.

#### GET one policy

An example request to get policy `http://example.org/policy`
with WebID `https://pod.example.com/profile/card#me` looks like this:

```curl
curl --location 'http://localhost:4000/uma/policies/http%3A%2F%2Fexample.org%2Fpolicy' \
--header 'Authorization: https://pod.example.com/profile/card#me'
```

Since the credentials match the assigner, the server responds with the information about the policy:

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

Updating a policy can be done through a PUT or a PATCH request to `/uma/policies/<encodedPolicyID>`,
each with different semantics.

#### PUT

A PUT completely replaces all rules of a policy the client is the assigner of.
The PUT works as a combination of DELETE and POST.
It requires a body with the same content type as the [POST request](#creating-policies).
This body will be interpreted as the requested policy with some rules.

The PUT process:

1. Find information about the policy.
   If it does not exist, return with a **status code 404** to indicate that you cannot rewrite a nonexistent policy.

2. Parse and validate the body, with the same procedure used in the POST endpoint.
   First, we perform the basic sanitization checks.
   Upon success, extra checks are performed to see if the new definition stays within the scope of the client:
     - Check that the newly defined policy does not define other policies
     - Check that the new policy does not contain any rules that do not belong to the client
     - Check that no unrelated quads to the policy and its rules are added.

    Failed checks will result in a response with **status code 400** and a dedicated message.
3. Delete the old policy, but keep a copy for a possible rollback.
   The deletion uses the procedure used in the [DELETE](#deleting-policies) endpoint.

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

#### PATCH

A PATCH request will update the policy and its related rules using a SPARQL update query.
The `content-type` header must be set to `application/sparql-update`.

The policy will be isolated from the store before executing the query, to make sure no other quads are affected.
After this, the query can be executed.
To make sure the policy remains a valid policy, the policy is isolated and checked again
before inserting the modified store back in the store.

##### Example PATCH request

The example below illustrates how policies can be changed using a PATCH request.
Notice that the content type has changed to `application/sparql-query`.

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

## Known issues and limitations

### Authentication

Current authentication is done by setting the `Authorization` header to a WebID.
There is no verification so any WebID can be entered.
In the future we want to support OIDC tokens for authentication.

### Sanitization

New policies and policy updates are sanitized with the following checks:

- Every defined rule must have a unique ID (`odrl:uid`).
- Every rule must have exactly one assigner.
- The assigner must match the authenticated WebID.

The sanitization check is quite limited and will not prevent all invalid policies.
On the other hand, it is not able to handle some triples that are valid,
such as collection definitions.

### Ownership

There is no ownership check to make sure users can only write policies they own.
This will require changes to the resource server as currently it does not inform the UMA server of ownership.

### PATCH limitations

PATCH only works on simple policies without constraints.
There is a known issue where nested triples, such as constraints, can get lost when modifying a policy.

### PUT identifier validation

The identifier is not validated correctly when doing a PUT request.
This means that the identifier of the policy you are PUTting does not need to match the identifier in the URL.
The policy that gets modified is based on the identifier found in the policy.

### Policies with multiple assigners

It is possible to have a policy with several rules,
which have different assigners.
Some known issues there:
- When GETting such a policy, you will only receive the identifiers of all linked rules,
  even those you are not the assigner of.
  You will not get the contents of those rules though.
- When DELETEing such a policy, all rules will be deleted,
  even those you are not the assigner of.
