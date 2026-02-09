# Access Request Management

Access requests can be used for users to request access to certain resources.
The Resource Owner (RO) can then decide to grant or deny this access.

This API is a work in progress, and will probably change in the future.

In the default configuration of the UMA server, the endpoint can be found at `/uma/requests`.

All requests require an **Authorization** header to identify the user performing the request.
The available options are described in
the [getting started documentation](getting-started.md#authenticating-as-resource-owner).

## Requesting access

A user can request access to a resource by performing a POST request to the endpoint.
The body of this request should be a JSON object,
describing the resource and the requested scopes:
```json
{
  "resource_id": "http://example.org/document",
  "resource_scopes": [ "http://www.w3.org/ns/odrl/2/read" ]
}
```

The `resource_id` field needs to be the identifier of the resource as known by the AS.
At the time of writing this is the same identifier as the one used by the RS.

This request will generate a request to allow the user creating this request to perform those scopes.

### Constraints

In case the user wants to request access, but with certain constraints,
these can be added in an additional field of the request:
```json
{
  "resource_id": "http://example.org/document",
  "resource_scopes": [ "http://www.w3.org/ns/odrl/2/read" ],
  "constraints": [
    [ "http://www.w3.org/ns/odrl/2/purpose", "http://www.w3.org/ns/odrl/2/eq", "http://example.org/purpose" ]
  ]
}
```

## Viewing requests

By performing a GET request to the endpoint, a user can see all requests they have created,
and all requests that target a resource they are the owner of.
This way a RO can see if there are still pending requests.

An example request would look as follows:
```turtle
@prefix sotw: <https://w3id.org/force/sotw#> .
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .

<http://example.org/request> a sotw:EvaluationRequest ;
      sotw:requestedTarget <http://example.org/document> ;
      sotw:requestedAction odrl:read ;
      sotw:requestingParty <https://example.org/bob> ;
      sotw:requestStatus sotw:requested .
```

There are no notifications, so the RO has to perform this request to discover a new request was made.
Similarly, a user has to perform this request to find out if the request was granted.

## Granting or rejecting requests

A RO can accept or deny a request by performing a PATCH request targeting the URL of a single request.
This URL is formed by appending the URL-encoded string of the request identifier to the endpoint.
For example, in the above case this would be `/uma/requests/http%3A%2F%2Fexample.org%2Frequest`.

The body of the PATCH request needs to be either `{ "status": "accepted" }` or `{ "status": "denied" }`.
In case the RO accepts the request,
a new policy will automatically be generated to grant the requested scopes to the requestee.

## Implementation Notes

* Request can not be deleted, as it is not yet clear who should be responsible for this.
* Requests can not be modified once accepted or denied.
* The generated policies can be found and modified through the policy API as usual.



This document describes the *access request administration endpoint*.
It contains the methods to describe how to create, read, update and delete access requests.
