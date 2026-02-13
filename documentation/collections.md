# ODRL policies targeting collections

This document describes how this UMA server supports ODRL collections.
The implementation is based on the [A4DS specification](https://spec.knows.idlab.ugent.be/A4DS/L1/latest/).
Much of the information in this document can also be found there.

## WAC / ACP

The initial idea for implementing collections is that we want to be able
to create policies that target the contents of a container,
similar to how WAC and ACP do this.
We do not want the UMA server to be tied to the LDP interface though,
so the goal is to have a generic solution that can handle any kind of relationship between resources.

## New resource description fields

To support collections, the RS now includes two additional fields when registering a resource,
in addition to those defined in the UMA specification.

* `resource_defaults`: A key/value map describing the scopes of collections having the registered resource as a source.
  The keys are the relations where the resource is the subject,
  and the values are the scopes that the Authorization Server should support for the corresponding collections.
* `resource_relations`: A key/value map linking this resource to others through relations.
  The keys are the relations and the values are the UMA IDs of the relation targets.
  The resource itself is the object of the relations,
  and the values in the arrays are the subject.
  Note that this is the reverse of the `resource_defaults` fields.

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
The new field `resource_defaults` tells the server that all containers for
the `http://www.w3.org/ns/ldp#contains` relation
that have this resource as the source,
have `read` as an available scope.
The `resource_relations` field indicates that this resource
has the `http://www.w3.org/ns/ldp#contains` relation with as target `assets:5678`,
while the other entry indicates it is the target of the `my:other:relation` with `assets:5678` as subject.

## Generating collection triples

When registering a resource,
the UMA server immediately generates all necessary triples to keep track of all collections a resource is part of.
First it generates the necessary asset collections based on the `resource_defaults` field,
and then generate the relation triples based on the `resource_relations` field.
With the example above, the following triples would be generated:

```ttl
@prefix odrl:   <http://www.w3.org/ns/odrl/2/>.
@prefix odrl_p: <https://w3id.org/force/odrl3proposal#>.

<urn:1:2:3> a odrl:AssetCollection ;
  odrl:source <my:new:resource> ;
  odrl_p:relation <http://www.w3.org/ns/ldp#contains> .

<my:new:resource> odrl:partOf <collection:12345> ;
                  odrl:partOf <collection:5678:reverse> .
```
This assumes that the collection IDs used above, `collection:12345` and `collection:5678:reverse`, already exist.
If these collections were not yet generated,
the registration request would fail with an error.
All these triples then get passed to the ODRL evaluator when policies need to be processed.
Any policy that targets a collection ID will apply to all resources that are part of that collection.
If the relation was reversed, the relation object would be `[ owl:inverseOf <http://www.w3.org/ns/ldp#contains> ]`.

### Finding collection identifiers

Currently, there is no API yet to request a list of all the automatically registered collections described above.
As a workaround, the generated collection identifiers are fixed, based on the relevant identifiers.
A collection with source `http://example.com/container/` and relation `http://www.w3.org/ns/ldp#contains`,
would have as collection identifier `collection:http://example.com/container/:http://www.w3.org/ns/ldp#contains`.
In case of a reverse relationship, this would instead be
`collection:http://www.w3.org/ns/ldp#contains:http://example.com/container/`.
These are the identifiers to then use as targets in a policy.

## Updating collection triples

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

### Asset Collection identifiers

For asset collections, there is a similar problem where the user doesn't know which identifiers to use.
To work around this,
users can create their own asset collections and add them to policies.
Take the following policy for example:

```ttl
@prefix ex:     <http://example.org/> .
@prefix ldp:    <http://www.w3.org/ns/ldp#>.
@prefix odrl:   <http://www.w3.org/ns/odrl/2/>.
@prefix odrl_p: <https://w3id.org/force/odrl3proposal#>.

<urn:uuid:e30bcd34-0d5c-43d1-b229-bf68afcae5ae> a odrl:Set ;
  odrl:uid <urn:uuid:e30bcd34-0d5c-43d1-b229-bf68afcae5ae> ;
  odrl:permission <urn:uuid:f4cb5007-e834-4a9c-a62a-091891350c04> .

<urn:uuid:f4cb5007-e834-4a9c-a62a-091891350c04> a odrl:Permission ;
  odrl:assignee ex:alice ;
  odrl:action odrl:read ;
  odrl:target ex:assetCollection .

ex:assetCollection a odrl:AssetCollection ;
  odrl:source <http://localhost:3000/container/> ;
  odrl_p:relation  ldp:contains .
```

The above policy gives Alice read permission on all resources in `http://localhost:3000/container/`.
Here the user chose the identifier `ex:assetCollection` for the collection with the given parameters.
When new resources are registered,
the UMA server will detect that this collection already exists,
and use that identifier for the new metadata triples.
It is important that this definition already exists in the policies before any resources get registered to it,
so this solution is better for static policy solutions,
where all policies are already defined on server initialization.
The server will error if there are multiple asset collections with the same parameters,
so make sure to only define identifier per combination.

### Parent containers not yet registered

Resource registration happens asynchronously.
As a consequence, it is possible when registering a resource,
that the registration of its parent container was not yet completed.
This is a problem since the UMA ID of this parent is necessary to link to the correct relation.
To work around this, resources get updated when the relevant information becomes available.
If the parent is not yet registered, a resource will be registered without the relevant relation fields.
Then, when the parent is registered, an event will trigger a registration update for the child resource,
where the registration is updated with the now available parent UMA ID.

### Accessing resources before they are registered

An additional consequence of asynchronous resource registration,
is that a client might try to access a resource before its registration is finished.
This would cause an error as the Resource Server needs the UMA ID to request a ticket,
but doesn't know it yet.
To prevent issues, the RS will wait until registration of the corresponding resource is finished,
or even start registration should it not have happened yet for some reason.
A timeout is added to prevent the connection from getting stuck should something go wrong.

### Policies for resources that do not yet exist

When creating a new resource on the RS, using PUT for example,
it is necessary to know if that action is allowed.
It is not possible to generate a ticket with this potentially new resource as a target though,
as it does not have an UMA ID yet.
The current implementation instead generates a ticket targeting the first existing (grand)parent container,
and requests the `create` scope.
