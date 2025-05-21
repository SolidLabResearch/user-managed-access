# ODRL policies targeting collections

This document describes how this UMA server supports ODRL collections,
and the issues encountered when implementing this,
some of which still need to be resolved cleanly.

## WAC / ACP

The main reason for adding support is that we wanted to be able to use ODRL policies
started from wanting to describe permissions on the contents of LDP containers.
We do not want the UMA server to be tied to the LDP interface though,
so the goal was to have a generic solution that can handle any kind of relationship between resources.

## Example ODRL policy

Below is an example of what a policy targeting the contents of a container looks like:

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
  odrl_p:relation ldp:contains .
```

The above policy gives Alice read permission on all resources in `http://localhost:3000/container/`.

## New resource description fields

To support collections, the RS now includes two additional fields when registering a resource,
in addition to those defined in the UMA specification.

* `resource_defaults`: A key/value map describing the scopes of collections having the registered resource as a source.
  The keys are the relations and the values are arrays of scopes.
* `resource_relations`: A key/value map linking this resource to others through relations.
  The keys are the relations and the values are the UMA IDs of the relation targets.
  If the relation starts with `^` a reverse relation is implied.

An example of such an extended resource description:
```json
{
  "resource_scopes": [ "read", "write" ],
  "resource_defaults": { 
    "http://www.w3.org/ns/ldp#contains": [ "read" ]
  },
  "resource_relations": { 
    "^http://www.w3.org/ns/ldp#contains": [ "assets:1234c" ]
  }
}
```

The above example tells the UMA server that the available scopes for this new resource are `read` and `write`,
as defined in the UMA specification.
The new field `resource_defaults` tells the server that all containers for
the `http://www.w3.org/ns/ldp#contains` relation
that have this resource as the source,
have `read` as an available scope.
Finally, the `resource_relations` field indicates that the resource `assets:1234c`
has the `http://www.w3.org/ns/ldp#contains` relation with as target the newly registered resource.
This is the reverse as indicated by the `^` in the string.

## UMA identifiers

Currently, the UMA server does not yet have the support to allow users to easily write policies using UMA IDs.
This is why all the example policies target the URLs of the resources in the RS.
To make sure this is still UMA compatible,
the UMA server copies the RS URL of the resource as UMA ID.
To provide this information to the UMA server,
the `name` field is used in the resource description when registering a resource.

## Transitive relations

The current implementation sees all relations as transitive.
This means that if resource A has relation R to resource B,
and resource B has relation R to resource C,
resource A is assumed to also have relation R to resource C.
As a consequence, policies targeting the collection that has as source C,
will be applicable to both A and B.

## Generating collection triples

When registering a resource,
the UMA server immediately generates all necessary triples to keep track of all collections a resource is part of.
When registering the resource in the example above,
the UMA server would first look for all collections matching the pattern
```ttl
@prefix odrl:   <http://www.w3.org/ns/odrl/2/>.
@prefix odrl_p: <https://w3id.org/force/odrl3proposal#>.

?a a odrl:AssetCollection ;
  odrl:source <assets:1234c> ;
  odrl_p:relation <http://www.w3.org/ns/ldp#contains> .
```

If no such collection exists, triples would be generated to create one.
The triple `<NEW-ID> odrl:partOf <COLLECTION-ID>` would then be added,
with `NEW-ID` being the newly generated UMA ID, and `COLLECTION-ID` being the ID of the matching collections.
Because of the transitive property described above,
the server would also look for all collections `assets:1234c` is a part of,
and continue doing this recursively for the collections it finds,
and also generate triples with those identifiers.
The internal ODRL evaluator will then use these triples to find the matching policies during evaluation.

## Known issues/workarounds

Below are some of the issues encountered while implementing this,
that might need more robust solutions.

### Parent containers not yet registered

Resource registration happens asynchronously.
As a consequence,
it is possible, when registering a resource,
that the registration of its parent container was not yet completed.
The UMA ID of this parent is necessary to link to the correct relation though.
The current solution is to register the resource without the relations and retry twice:
once immediately after the registration is successful, and once after 30 seconds.

A more robust solution would be preferable, where it is guaranteed that the parent relation will always be registered.

### Policies for resources that do not yet exist

When creating a new resource on the RS, using PUT for example,
it is necessary to know if that action is allowed.
It is not possible to generate an UMA ticket with this potentially new resource as a target though,
as it does not have an UMA ID yet since it does not yet exist.
The current implementation instead generates a ticket targeting the first existing (grand)parent container,
and requests the `create` scope.

Solid does have some edge case situations that are no longer covered this way.
For example, trying to read a non-existent resource would give a different response
depending on if the client was allowed to read it or not (404 vs 401/403).

### How to determine which side of the relation is the collection

When resource registrations include the `resource_relations` field,
it indicates relations of the form `A R B`.
With A or B being the newly registered resource,
depending on if the relation is reversed or not.

One of the sides of the relation would be the source of a collection,
and the other side would then be part of that collection.
Currently, we have no clear way to indicate which is which,
so for now the server will always assume the subject of the triple is the collection source.
