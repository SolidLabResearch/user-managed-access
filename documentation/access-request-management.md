# Access Request Management

This document describes the *access request administration endpoint*.
It contains the methods to describe how to create, read, update and delete access requests.
Example cURL-requests are provided for ease of use (inspired by the workflow in the first part of [this file](https://github.com/bramcomyn/loama/blob/feat/odrl/documentation/access_grants_vs_dsnp.md)).

The general flow of access requests and grants looks like this:

![Access requests and grants flow](./figures/access_grants_requests_fsm.png).

The document makes use of these parties and identifiers:

- **Resource Owner**: `https://pod.harrypodder.org/profile/card#me`
- **Authorization Server**: `http://localhost:4000`
- **Resource Server**: `http://localhost:3000/resources`
- **Requesting Party**: `https://example.pod.knows.idlab.ugent.be/profile/card#me`

The examples provided below make use of `text/turtle` and `application/sparql-update` messages.

## Supported endpoints

The current implementation supports the following requests to the `uma/requests` endpoint

- [**GET**](#reading-access-requests)
- [**POST**](#creating-access-requests)
- [**PATCH**](#updating-access-requests)
- [**DELETE**](#deleting-access-requests)

## Creating access requests

Create an access request/multiple access requests by sending a **POST** request to `uma/requests`.
Apart from its `Authorization` header, the `Content-Type` header must be set to the RDF serialization format in which the body is written.
The accepted formats are those accepted by the [N3 Parser](https://github.com/rdfjs/N3.js/?tab=readme-ov-file#parsing), represented by the following content types:

- `text/turtle`
- `application/trig`
- `application/n-triples`
- `application/n-quads`
- `text/n3`

The body is expected to represent a valid ODRL access reques.
No sanitization is currently applied.
Upon success, the server responds with **status code 201**.
Bad requests, possibly due to improper access request definition, will respond with **status code 400** (to be implemented) <!-- TODO: implement -->
When the access requested has been validated (to be implemented), but the storage fails, the response will have **status code 500**.

### Example POST request

This example creates an access request `ex:request` for the RP `https://example.pod.knows.idlab.ugent.be/profile/card#me`:

```shell-session
curl --location 'http://localhost:4000/uma/requests' \
--header 'Authorization: https://example.pod.knows.idlab.ugent.be/profile/card#me' \
--header 'Content-Type: text/turtle' \
--data-raw '
@prefix sotw: <https://w3id.org/force/sotw#> .
@prefix odrl: <https://www.w3.org/ns/odrl/2/> .
@prefix dcterms: <https://purl.org/dc/terms/> .
@prefix dct: <https://purl.org/dc/terms/> .
@prefix ex: <https://example.org/> .
@prefix xsd: <https://www.w3.org/2001/XMLSchema#> .

ex:request a sotw:EvaluationRequest ;
      dcterms:issued "2025-08-21T11:24:34.999Z"^^xsd:datetime ;
      sotw:requestedTarget <http://localhost:3000/resources/resource.txt> ;
      sotw:requestedAction odrl:read ;
      sotw:requestingParty <https://example.pod.knows.idlab.ugent.be/profile/card#me> ;
      ex:requestStatus ex:requested .
'
```

## Reading access requests

To read policies, a single endpoint is currently implemented.
This endpoint currently returns the list of access requests where the WebID provided in the `Authorization` header is marked as the requesting party.
[See also](#coupling-of-target-to-ros).
An example request to this endpoint is:

```shell-session
curl -X GET --location 'http://localhost:4000/uma/requests' \
--header 'Authorization: https://example.pod.knows.idlab.ugent.be/profile/card#me'
```

## Updating access requests

Updating policies can be done through a **PATC** request.
The body must hold the content type `application/sparql-update`.
The query can use the **DELETE/INSERT** statement to update properties of the access request.
The example below shows how to update the access request's status from `requested` to `accepted`:

```shell-session
curl -X PATCH --location 'http://localhost:3000/' \
--header 'Authorization: https://example.pod.knows.idlab.ugent.be/profile/card#me' \
--header 'Content-Type: application/sparql-update' \
--data-raw '
PREFIX ex: <https://example.org/>
PREFIX sotw: <https://w3id.org/force/sotw#>

DELETE {
    ?request ex:requestStatus ex:requested .
} INSERT {
    ?request ex:requestStatus ex:accepted . # change to `ex:denied` in order to deny
} WHERE {
    ?request sotw:requestedTarget <http://localhost:3000/resources/resource.txt> .
}'
```

## Deleting access requests

<!-- TODO: figure out -->

## Future work

### Discrepancies between [earlier descriptions](https://github.com/bramcomyn/loama/blob/feat/odrl/documentation/access_grants_vs_dsnp.md) and this implementation

The current implementation is not entirely as explained in [this file](https://github.com/bramcomyn/loama/blob/feat/odrl/documentation/access_grants_vs_dsnp.md).
In order to comply with what is explained there, there should be a unique identifier to each access request in the AS, as well as a new endpoint.
The **DELETE** endpoint is not described in the file mentioned, but is simply added because it was possible to do so.

### Coupling of target to ROs

There is no coupling between the target resource and the resource owner at this moment.
Future implementations should make it in such way that the resource owner can fetch access requests concerning their resources.
This will require a change in the way the **GET** requests are being handled now, as they currently return only access requests where the client is the requesting party.

### Authorization checking

Currently, there is no check for authorization from the requested party.
A simple WebID check in the `Authorization` header should be enough to illustrate the principle.
Besides that, **PATCH** requests should have some check of the SPARQL query in order to check its validity and structure.
