# Getting started

This tutorial uses step-by-step examples to explain
how the different pieces in this repository work together
to combine a User Managed Acces (UMA) authorization server with a Solid resource server,
and which additions we have made to make this work.
The main goal is to have a grasp on how to use this project,
which means some concepts of the several protocols involved here
are simplified or omitted.

For the full details, we refer to the official documentation:
* UMA: https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-grant-2.0.html
* Federated UMA: https://docs.kantarainitiative.org/uma/wg/rec-oauth-uma-federated-authz-2.0.html
* Solid: https://solidproject.org/TR/
* A4DS: https://spec.knows.idlab.ugent.be/A4DS/L1/latest/
  * This covers changes and choices made in this repository

It is recommended to go through the
[Community Solid Server (CSS) tutorial](https://github.com/CommunitySolidServer/tutorials/blob/main/getting-started.md),
as that covers the basics of Solid and the CSS,
which is used as a basis for this repository and this guide.

Note that this repository, and how the protocols are implemented, is still changing,
so some information might change depending on which version and branch you're using.

## Index

- [Getting started](#getting-started)
  * [Starting the server](#starting-the-server)
  * [Authenticating the Resource Server](#authenticating-the-resource-server)
  * [Locating the Authorization Server](#locating-the-authorization-server)
  * [Resource registration](#resource-registration)
    + [About identifiers](#about-identifiers)
  * [Resource access](#resource-access)
    + [Informing the UMA Authorization Server](#informing-the-uma-authorization-server)
    + [Generating a ticket](#generating-a-ticket)
      - [Publicly accessible resources](#publicly-accessible-resources)
    + [Exchange ticket](#exchange-ticket)
      - [Claim security](#claim-security)
    + [Generate token](#generate-token)
    + [Use token](#use-token)
  * [Policies](#policies)
  * [Adding or changing policies](#adding-or-changing-policies)

<small><i><a href='http://ecotrust-canada.github.io/markdown-toc/'>Table of contents generated with markdown-toc</a></i></small>

## Starting the server

This repository contains several startup and test scripts,
as described in the [README](../README.md).
In this guide, we describe more in-depth what happens in some of these scripts.

To begin, run the `yarn start` script,
which sets up the necessary servers.
Specifically, this starts a UMA Authorization Server (AS) at `http://localhost:4000`,
and a Solid Resource Server (RS) at `http://localhost:3000`.
It also initializes several resources in-memory,
using [pod seeding](https://communitysolidserver.github.io/CommunitySolidServer/latest/usage/seeding-pods/),
to make it easier to get started.

You can see the AS working by going to <http://localhost:4000/uma/.well-known/uma2-configuration>.
This page contains all the relevant APIs of the UMA server,
which are used in the next steps.

## Authenticating the Resource Server

Throughout this guide, there are several instances where the RS has to send an HTTP request to the AS.
The AS needs some way to verify if the request comes from the RS.
The current implementation makes use of [HTTP signatures](https://datatracker.ietf.org/doc/html/rfc9421).
To enable this, the RS needs to expose a [JSON Web Key](https://datatracker.ietf.org/doc/html/rfc7517).
This key can be found at the `jwks_uri` API of OpenID configuration of the RS,
seen at <http://localhost:3000/.well-known/openid-configuration>.
The RS uses that same key to sign its messages as described in the RFC,
using the [http-message-signatures](https://www.npmjs.com/package/http-message-signatures) library.
This is done for every HTTP request the RS sends to the AS in the following sections.

## Locating the Authorization Server

To be able to communicate with it, the RS needs to know where to find the AS.
The current implementation of the RS knows this through server configuration.
This can be seen in the startup script in the [RS package.json](../packages/css/package.json)
when looking at the `start` script.
It uses the CLI parameter `-a http://localhost:4000/` to inform the RS where it can find the relevant AS,
which internally sets the Components.js variable `urn:solid-server:uma:variable:AuthorizationServer`
to the provided value.

## Resource registration

The Federated UMA specification requires that the RS registers every resource at the AS.
This way the AS knows for which resources it needs to manage the access.
As several resources are created immediately due to the pod seeding,
these all need to be registered at the AS.
The RS does this by POSTing a request to the `resource_registration_endpoint` API with the following body:
```json
{
  "resource_scopes": [
    "urn:example:css:modes:read",
    "urn:example:css:modes:append",
    "urn:example:css:modes:create",
    "urn:example:css:modes:delete",
    "urn:example:css:modes:write"
  ]
}
```

This tells the AS that it should register a new resource,
and what its available scopes are.
The above scopes are those currently supported by the server setup,
and are mostly based on the similar scopes defined by
the [WAC specification](https://solid.github.io/web-access-control-spec/).
The `create` scope is different and indicates the client wants to create a new resource in the given container.

When the AS receives this request, it mints a new identifier.
This identifier is used to represent the resource on the AS side,
in the relevant policies that determine access.
The Solid identifier of the resource is irrelevant,
and not even known by the AS.
If the request is successful,
the AS responds with a 201 status code.
The location header contains the new identifier.
The RS stores this identifier, linked to the Solid identifier, for future use.

### About identifiers

As mentioned above, the UMA identifier and Solid identifier are independent identifiers,
with the UMA AS only knowing the former.
This means that whoever writes the policies that determine access,
need to be aware of the UMA identifiers of resources.
Work is currently being done on having an API that provides all the necessary information,
so users are informed of which resources correspond to which identifiers.
As this is currently not clear to users yet,
the "minted" identifier on the UMA server is the same as the Solid identifier.
To inform the UMA server of what the Solid identifier is,
the Solid RS needs to add a `name` field to the registration body described above,
with the value being the Solid identifier. E.g.:
```json
{
  "name": "http://localhost:3000/my/resource",
  "resource_scopes": [
    "urn:example:css:modes:read",
    "urn:example:css:modes:append",
    "urn:example:css:modes:create",
    "urn:example:css:modes:delete",
    "urn:example:css:modes:write"
  ]
}
```
In the future, this field will be used to describe the resource instead of using it as the actual identifier.

## Resource access

When trying to access a resource,
several steps have to be taken by both the client and both servers.
These are described in-depth in the relevant specifications.
In this section, we go through all the steps of a single PUT request,
targeting `http://localhost:3000/alice/private/resource.txt`.
This same example can be seen in [scripts/test-private.ts](../scripts/test-private.ts).

### Informing the UMA Authorization Server

The first step of a request is the same as it is for a Solid server with a standard authorization server:
send the PUT request to the Solid RS.
As usual, the RS first determines which scopes are necessary.
As `http://localhost:3000/alice/private/resource.txt` does not exist yet,
these scopes need to indicate that the client wants to create a new resource.
When using UMA, scopes need to be determined on registered resources.
This means that it is not possible to require scopes on resources that do not exist yet,
as is possible with WAC.
To support this requirement, when a new resource needs to be created,
`create` permissions will be required on the first existing parent container.
Since `http://localhost:3000/alice/private/` also does not exist,
this request requires `create` permissions on `http://localhost:3000/alice/`.

Once the RS determines the scopes, it contacts the AS through the `permission_endpoint` API.
It performs a `POST` request with a JSON body containing the UMA identifier of the resource
and the requested scopes, which looks as follows:
```json
{
  "resource_id": "12345", // Assume this is the UMA ID of http://localhost:3000/alice/
  "resource_scopes": [
    "urn:example:css:modes:create"
  ]
}
```

### Generating a ticket

The first thing the AS has to do when receiving any HTTP request is to validate the signature, as discussed above.
Afterward, it creates a ticket identifier, links it with the request body,
and responds to the RS request with a 201 status code.
The location header of the response contains the ticket identifier.
The RS then responds to the client, which is still waiting for a response,
with a 401 status code.
To inform the client on how to acquire access,
the 401 response has a `WWW-Authenticate` header
with value `UMA realm="solid", as_uri="http://localhost:4000/uma/", ticket="TICKET_ID"`.
The client then parses this header to know where the AS is,
and what the ticket identifier is that it needs to present there.

#### Publicly accessible resources

UMA requires the above process for every resource access.
This makes it impossible to have public resources that can be accessed with, for example, a simple GET request.
To still allow for such situations,
the AS will return a 200 response, instead of a 201,
if it determines no claims are required to perform the request.
In that case, the RS will execute the client's request immediately, instead of returning a 401 with a ticket.

### Exchange ticket

To receive access, the client has to exchange the ticket for a token at the AS.
This is done through the `token_endpoint` API.
Besides the ticket, the client has to include the necessary claims to identify itself.
The only claim currently supported by the AS, is the WebID,
which for this example is `https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me`.
To make the request, the client performs a POST with the following JSON body:
```json
{
  "grant_type": "urn:ietf:params:oauth:grant-type:uma-ticket",
  "ticket": "TICKET_ID",
  "claim_token": "https%3A%2F%2Fwoslabbi.pod.knows.idlab.ugent.be%2Fprofile%2Fcard%23me",
  "claim_token_format": "urn:solidlab:uma:claims:formats:webid"
}
```
The `claim_token_format` explains to the AS how the `claim_token` should be interpreted.
In this case, this is a custom format designed for this server,
where the token is a URL-encoded WebID.

#### Claim security

In the above body, the claim token format is a string representing a WebID.
No actual authentication or verification takes place here,
meaning anyone can insert any WebID they want.
This is great for quickly testing things out,
but less good for security and testing actual authentication.
The AS also supports OIDC tokens as defined in the [Solid OIDC specification](https://solid.github.io/solid-oidc/).
In that case, the `claim_token_format` should be `http://openid.net/specs/openid-connect-core-1_0.html#IDToken`.

### Generate token

Once the AS receives a token request, it has to match the ticket ID
with the scopes it stored internally in a previous step.
Based on the stored policies, it then determines if the provided claims are sufficient to allow the request.
How these policies work will be covered later on.
If successful, the server will return a 200 response with a JSON body containing, among others,
an `access_token` field containing the access token, and a `token_type` field describing the token type.
If the claims are insufficient, a 403 response will be given instead.

### Use token

When receiving the access token, the client can perform the same request as it did in the first step,
but now include an `Authorization` header with value `TOKEN_TYPE ACCESS_TOKEN`,
based on the response values in the previous step.
When receiving this, the RS validates the token with the AS,
similarly how this is done with a standard Solid server with OIDC.
If the token is valid,
it then performs the request the client wanted.

## Policies

To determine the allowed scopes on a resource,
the AS makes use of ODRL policies,
for which we refer to the [specification](https://www.w3.org/TR/odrl-model/) for the full details.
For our purposes, the AS does not use everything from the ODRL specification yet, such as refinements and duties,
but only the core building blocks.
Below is an example of the policy that allowed the example above to succeed:
```ttl
@prefix ex: <http://example.org/1707120963224#> .
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .

ex:usagePolicy a odrl:Agreement ;
                odrl:permission ex:permission .
ex:permission a odrl:Permission ;
              odrl:action odrl:create ;
              odrl:target <alice/private/> , <alice/private/resource.txt> ;
              odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .
```
This policy says that the above WebID has access to the `create` scope
on `<alice/private/>` and `<alice/private/resource.txt>`.
The server is configured so the base URL of all policy documents is the URL of the RS, `http://localhost:3000/`,
to make sure the identifiers match the Solid resource identifiers as discussed [above](#about-identifiers).

## Adding or changing policies

When starting the server with `yarn start`,
the server is configured to load all policies from a specified folder.
In this case, this is [packages/uma/config/rules/policy](../packages/uma/config/rules/policy).
This is done by setting the Components.js variable `urn:uma:variables:policyBaseIRI` to the necessary folder,
as can be seen in the start script at [packages/uma/bin/main.js](../packages/uma/bin/main.js).
With this setup,
there is no way to change the policies while the server is running.
The only way is to change the folder and restart the server.

An alternative setup is used with the `yarn start:demo` script.
There the server is configured to read all policies from a specific Solid container,
set by the `urn:uma:variables:policyContainer` variable.
This way, it is possible to modify the policies at run-time by changing the contents of that container.
In this case, it is important to make sure UMA is not used to handle the access of that container,
as that would prevent the UMA server from readings its contents to determine the policies.

Both of these options have their issues,
so work is being done on having a more secure and usable solution.
