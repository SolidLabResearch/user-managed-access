# ODRL policies targeting collections

This document describes how this UMA server supports ODRL collections.
There are 2 main kinds of collections:
custom collections created by a user through the collection API,
and automatically generated collections based on registering resource relations.

## Collection API

The UMA server exposes the collection API through the `/collections` URl.
Individual collections can be accessed through `/collections/{id}`.
All CRUD operations are supported for both asset and party collections.

All requests require authentication as
described in the [getting started documentation](getting-started.md#authenticating-as-resource-owner).

### Create

New collections are with POST requests to the collection API.
The request body should be JSON, with the contents depending on the type of collection.
The description field is always optional.

If successful, the response will have status code 201
with the identifier of the new collection in the location header.
This identifier is the full URL to be used when sending requests to update or read this specific collection.

#### Asset collections

```json
{
  "description": "My asset collection",
  "type": "asset",
  "parts": [ "http://example.com/my-resource", "http://example.com/my-other-resource" ]
}
```

The identifiers in the `parts` array need to be the UMA identifiers of the resources.
The client performing the request needs to be authenticated as the Resource Owner of all resources in the array,
or the request will be rejected.

#### Party collections

```json
{
  "description": "My asset collection",
  "type": "party",
  "owners": [ "http://example.com/alice/card#me" ],
  "parts": [ "http://example.com/alice/card#me", "http://example.com/bob/card#me" ]
}
```

The `owners` array defines who will be allowed to modify the collection,
and can not be empty.
The client performing the request needs to be one of the owners.

### Update

A collection can be updated by performing a put request to `/policies/{id}`.
This full URL is also the URL that will be returned in the location header when performing a POST request.
The body should be the same as above, and will replace the existing collection.
A collection can only be modified by one of the owners,
in case of an asset collection, this is the owner of the collected resources.

### Read

All owned collections can be seen by performing a GET request to the collection API.
A single collection can be seen by performing a GET to its specific URL.
A result would look as follows:

```ttl
@prefix dc: <http://purl.org/dc/terms/>.
@prefix odrl: <http://www.w3.org/ns/odrl/2/>.

<http://example.com/assets> a odrl:AssetCollection ;
  dc:description "My assets" ;
  dc:creator <http://example.com/alice/card#me> .
<http://example.com/alice/> odrl:partOf <http://example.com/assets> .
<http://example.com/alice/README> odrl:partOf <http://example.com/assets> .

<http://example.com/party> a odrl:PartyCollection ;
  dc:description "My party" ;
  dc:creator <http://example.com/alice/card#me> .
<http://example.com/alice/card#me> odrl:partOf <http://example.com/party> .
<http://example.com/bob/card#me> odrl:partOf <http://example.com/party> .
```

### Delete

A collection can be removed by performing a DELETE request to the URL of the collection.
Similar to updates, this can only be done by one of the owners.

## Relation collections

The UMA server will automatically generate collections,
based on [relation metadata](https://spec.knows.idlab.ugent.be/A4DS/L1/latest/#dom-resourcedescription-resource_relations)
provided during resource registration.


### New resource description fields

To support collections, the RS can include two additional fields when registering a resource.

* `resource_defaults`: A key/value map describing the scopes of collections having the registered resource as a source.
  The keys are the relations where the resource is the subject,
  and the values are the scopes that the Authorization Server should support for the corresponding collections.
* `resource_relations`: A key/value map linking this resource to others through relations.
  The keys are the relations and the values are the UMA IDs of the relation targets.
  The resource itself is the object of the relations,
  and the values in the arrays are the subject.

For both of the above, one of the keys can be `@reverse`,
which takes as value a similar key/value object,
but reverses how the relations should be interpreted.
E.g., in the case of `resource_defaults`,
the resource would be the object instead of the subject of those relations.

An example of such an extended resource description:
```json
{
  "resource_scopes": [ "read", "write" ],
  "resource_defaults": { 
    "http://www.w3.org/ns/ldp#contains": [ "read" ]
  },
  "resource_relations": {
    "http://www.w3.org/ns/ldp#contains": [ "assets:1234" ],
    "@reverse": { "my:other:relation": [ "assets:5678" ] }
  }
}
```

The above example tells the UMA server that the available scopes for this new resource are `read` and `write`,
as defined in the UMA specification.
The `resource_defaults` field indicates that the collection corresponding to all resources
this resource has the `http://www.w3.org/ns/ldp#contains` relation to, have the `read` scope.

The `resource_relations` field indicates that this resource
has the `http://www.w3.org/ns/ldp#contains` relation with as target `assets:1234`,
while the other entry indicates it is the target of the `my:other:relation` with `assets:5678` as subject.

### Generating collection triples

When registering a resource,
the UMA server immediately generates all necessary triples to keep track of all collections a resource is part of.
First it generates the necessary asset collections based on the `resource_defaults` field,
and then generates the relation triples based on the `resource_relations` field.

Assuming a resource `my:parent:resource` is registered with a `http://www.w3.org/ns/ldp#contains` `resource_default`,
the following triples would be generated:
```ttl
@prefix odrl:   <http://www.w3.org/ns/odrl/2/>.
@prefix odrl_p: <https://w3id.org/force/odrl3proposal#>.

<collection:my:parent:resource:http://www.w3.org/ns/ldp#contains> a odrl:AssetCollection ;
  odrl:source <my:parent:resource> ;
  odrl_p:relation <http://www.w3.org/ns/ldp#contains> .
```
If the relation was reversed, the relation object would be `[ owl:inverseOf <http://www.w3.org/ns/ldp#contains> ]`.

Then, if another resource, `my:new:resource`, is registered
with a reverse `http://www.w3.org/ns/ldp#contains` relation targeting `my:parent:resource`,
the following additional triple would be generated:
```ttl
@prefix odrl:   <http://www.w3.org/ns/odrl/2/>.
<my:new:resource> odrl:partOf <collection:my:parent:resource:http://www.w3.org/ns/ldp#contains> .
```

All these triples get passed to the ODRL evaluator when policies need to be processed.
Any policy that targets a collection ID will apply to all resources that are part of that collection.

### Finding collection identifiers

Collection identifiers can be found through the policy API, described above.
For now, the generated collection identifiers are fixed, based on the relevant identifiers,
but it should be assumed that these can change in the future.
A collection with source `http://example.com/container/` and relation `http://www.w3.org/ns/ldp#contains`,
would have as collection identifier `collection:http://example.com/container/:http://www.w3.org/ns/ldp#contains`.
In case of a reverse relationship, this would instead be
`collection:http://www.w3.org/ns/ldp#contains:http://example.com/container/`.
These are the identifiers to then use as targets in a policy.

### Updating collection triples

Every time a resource is updated, the corresponding collection triples are updated accordingly.
If an update removes some of the `resource_relations` entries,
the relevant `odrl:partOf` triples will be removed.
If entries are removed from `resource_defaults`,
the triples that define the corresponding asset collection are removed.
The latter can only happen if the asset collection is empty.
In case there are still `odrl:partOf` triples linking to it,
the update will fail with an error.

It is possible to generate the same relation in two different ways:
in the description of the source, and in the description of the target.
Since updates to one resource can remove relations,
this can potentially cause some confusion and/or inconsistencies.
E.g., if resource A is registered with relation L to resource B,
and B is registered with the reverse of L to resource A.
Both these statements apply to the same relation.
If resource A is then updated without that relation,
it would be removed while the description of B still contains it.
For this reason it is advised to always describe relations in only one of the two resources.

## Known issues/workarounds

Below are some of the issues encountered while implementing this,
that might need more robust solutions.

### UMA identifiers

The UMA server is only aware of the UMA identifiers;
it does not know the resource identifiers.
Those are also the identifiers that need to be used when writing policies.
Eventually, there should be an API an interface so users know which identifiers they need to use.
To make things easier until that is resolved,
the servers are configured so the generated UMA identifiers correspond to the actual resource identifiers.
The Resource Server informs the UMA server of the identifiers by using the `name` field when registering a resource.

### Parent containers not yet registered

Resource registration happens asynchronously in the CSS RS implementation.
As a consequence, it is possible when registering a resource,
that the registration of its parent container was not yet completed.
This is a problem since the UMA ID of this parent is necessary to link to the correct relation.
To work around this, resources get updated when the relevant information becomes available.
If the parent is not yet registered, a resource will be registered without the relevant relation fields.
Then, when the parent is registered, an event will trigger a registration update for the child resource,
where the registration is updated with the now available parent UMA ID.

### Accessing resources before they are registered

An additional consequence of asynchronous resource registration in the CSS RS implementation,
is that a client might try to access a resource before its registration is finished.
This would cause an error as the Resource Server needs the UMA ID to request a ticket,
but doesn't know it yet.
To prevent issues, the RS will wait until registration of the corresponding resource is finished.
A timeout is added to prevent the connection from getting stuck should something go wrong.

### Policies for resources that do not yet exist

When creating a new resource on the CSS RS, using PUT for example,
it is necessary to know if that action is allowed.
It is not possible to generate a ticket with this new resource as a target though,
as it does not have a UMA ID yet.
The current implementation instead generates a ticket targeting the first existing (grand)parent container,
and requests the `create` scope.
