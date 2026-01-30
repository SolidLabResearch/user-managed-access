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
  * [Index](#index)
  * [Starting the server](#starting-the-server)
  * [Authenticating as Resource Owner](#authenticating-as-resource-owner)
  * [Authenticating as Resource Server](#authenticating-as-resource-server)
    + [Requesting client credentials](#requesting-client-credentials)
    + [Sending the credentials to the RS (CSS specific)](#sending-the-credentials-to-the-rs--css-specific-)
    + [Requesting a PAT as RS](#requesting-a-pat-as-rs)
  * [Resource registration](#resource-registration)
    + [About identifiers](#about-identifiers)
  * [Resource access](#resource-access)
    + [Informing the UMA Authorization Server](#informing-the-uma-authorization-server)
    + [Generating a ticket](#generating-a-ticket)
      - [Publicly accessible resources](#publicly-accessible-resources)
    + [Exchange ticket](#exchange-ticket)
      - [Authentication methods](#authentication-methods)
      - [Customizing OIDC verification](#customizing-oidc-verification)
    + [Generate token](#generate-token)
    + [Use token](#use-token)
  * [Policies](#policies)
    + [Client application identification](#client-application-identification)
  * [Adding or changing policies](#adding-or-changing-policies)
  * [Policy backups](#policy-backups)
  * [Data aggregation](#data-aggregation)

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

## Authenticating as Resource Owner

There are some APIs on the AS where a Resource Owner (RO) has to identify themself.
Specifically, the policy APIs, as described in the [policy management documentation](policy-management.md),
and the client credentials API described further below.
Two authentication methods are supported: OIDC tokens, both Solid and standard, and unsafe WebID strings.

To use OIDC, the `Bearer` authorization scheme needs to be used, followed by the token.
For example, `Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI...`.

To directly pass a WebID, the `WebID` scheme can be used together with a URL encoded WebID.
For example, `Authorization: WebID http%3A%2F%2Fexample.com%2Fprofile%2Fcard%23me`.
No validation is performed in this case, so this should only be used for development and debugging purposes.

## Authenticating as Resource Server

The RS has to send several requests to the AS, as described below.
Generally, these requests are done for a specific user,
e.g., registering a resource for its owner,
or requesting access on an owner's resource.
To identify both itself and the owner,
the RS has to send a Personal Access Token (PAT) in the authorization header
when making such a request.
As the UMA specification does not have strong requirements on how such a token should be generated,
the specific implementation of our AS is described here.

The following steps need to be taken:
1. The owner requests client credentials from the AS for a specific RS, which is the client here,
   as described in RFC 7591.
2. The AS returns an id/secret combination which uniquely identifies this owner/RS combination.
3. The owner provides this id/secret combination to the RS, together with the URL of the corresponding AS.
4. Before making a request, the RS uses this id/secret combination to request an access token from that AS
   with scope `uma_protection`, as described in RFC 6749 and RFC 7617.
   This token is the PAT.
5. The RS uses this bearer token for the request.

### Requesting client credentials

To register a RS, the owner should find the `registration_endpoint` API in the AS' UMA configuration.
They should then POST a request there with a body as follows:
```json
{
  "client_name": "descriptive name for the RS (optional)",
  "client_uri": "http://localhost:3000"
}
```

The AS will then respond with client credentials such as
```json
{
  "client_uri": "http://localhost:3000",
  "client_name": "descriptive name for the RS (optional)",
  "client_id": "1be8b63f-29c2-4d2c-9932-8784a28de5cf",
  "client_secret": "184984651984...",
  "client_secret_expires_at": "0",
  "grant_types": [ "client_credentials", "refresh_token" ],
  "token_endpoint_auth_method": "client_secret_basic"
}
```

This response, or at least the `client_id` and `client_secret` should then be passed along to the RS.

### Sending the credentials to the RS (CSS specific)

This section is specific for our CSS implementation of the RS
and is irrelevant if you have your own custom RS.

The implementation makes use of the
[CSS account API](https://communitysolidserver.github.io/CommunitySolidServer/latest/usage/account/json-api/).
A new `pat` entry has been added to the account controls after authenticating.
This API expects a POST request with the following body:
```json
{
  "id": "1be8b63f-29c2-4d2c-9932-8784a28de5cf",
  "secret": "184984651984...",
  "issuer": "http://localhost:4000/uma"
}
```
Sending this request will update the stored credentials for the authenticated user.

### Requesting a PAT as RS

To request a PAT, the RS needs to find the `token_endpoint` API in the AS UMA config.
A PAT can then be requested by sending a POST request with a `application/x-www-form-urlencoded` body as follows:
```
grant_type=client_credentials&scope=uma_protection
```
A JSON body containing the same information would also work.

The important thing is that the `Authorization` header needs to be set using the Basic id/secret combination
as described in RFC 7617.
Specifically, that means you generate a string `$MY_ID:$MY_secret` and generating the base 64 encoding of this result.
The Authorization header should then contain `Basic $ENCODED_RESULT`.

The AS will then respond with a body containing the generated access token:
```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token":  "efe2dea0-9cb4-4ffd-9dbe-a581a249202b",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "uma_protection"
}
```

This access token then needs to be sent along in a Bearer Authorization header when making the necessary requests.
The current implementation of the AS allows the PAT to be reused until it is expired,
which can be useful when doing bulk resource registration.

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
the AS responds with a 201 status code and the UMA identifier in the body.
The location header contains the URL needed to update the registration.
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

The first thing the AS has to do when receiving any HTTP request is to validate the PAT, as discussed above.
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

#### Authentication methods

The above claim token format indicates that the claim token should be interpreted as a valid WebID.
No validation is done, so this should only be used for debugging and development.

It is also possible to use `http://openid.net/specs/openid-connect-core-1_0.html#IDToken` as token format instead.
In that case the body is expected to be an OIDC ID token.
Both Solid and standard OIDC tokens are supported.
In case of standard tokens, the value of the `sub` field will be used to match the assignee in the policies.

The values that are extracted from the OIDC token are expected to be IRIs.
In case the `sub` or `azp`, which is discussed below, values are not IRIs,
the server wil internally convert them by URL encoding the value, and prepending them with `http://example.com/id/`.
This means that your policies should reference the converted ID.
For example, if your `sub` value is `my id`, your policy needs to target `http://example.com/id/my%20id`.
This base URL will be updated in the future once we have settled on a fixed value.

#### Customizing OIDC verification

Several configuration options can be added to further restrict authentication when using OIDC tokens,
by adding entries to the Components.js configuration of the UMA server.
All options of the [verification function](https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md)
can be added.
For example, the max age of a token can be set to 60s by adding the following block:
```json
{
  "@id": "urn:uma:default:OidcVerifier",
  "verifyOptions": [
    {
      "OidcVerifier:_verifyOptions_key": "maxTokenAge",
      "OidcVerifier:_verifyOptions_value": 60
    }
  ]
}
```
Other options can be added in a similar fashion by adding entries to the above array.

It is also possible to restrict which token issuers are allowed.
This can be done by adding the following configuration:
```json
{
  "@id": "urn:uma:default:OidcVerifier",
  "allowedIssuers": [
    "http://example.com/idp/",
    "http://example.org/issuer/"
  ]
}
```

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
                odr:uid ex:usagePolicy ;
                odrl:permission ex:permission .
ex:permission a odrl:Permission ;
              odrl:action odrl:create ;
              odrl:target <http://localhost:3000/alice/private/> ;
              odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> .
```
This policy says that the above WebID has access to the `create` scope on `<http://localhost:3000/alice/private/>`.

### Client application identification

It is possible to create policies that restrict access based on the client application being used.
This can only be done when using an OIDC ID token for authentication.
The `azp` claim of the token will be used.

To restrict a policy to a certain client application,
a constraint needs to be added to the policy.
Due to some issues with internal libraries,
the `odrl:purpose` constraint is currently used to identify the client.
This will be fixed in the near future.

To restrict a policy to only permit access when using the application `http://example.com/client`,
the policy should look as follows:
```ttl
@prefix ex: <http://example.org/1707120963224#> .
@prefix odrl: <http://www.w3.org/ns/odrl/2/> .

ex:usagePolicy a odrl:Agreement ;
                odrl:uid ex:usagePolicy ;
                odrl:permission ex:permission .
ex:permission a odrl:Permission ;
              odrl:action odrl:create ;
              odrl:target <http://localhost:3000/alice/private/> ;
              odrl:assignee <https://woslabbi.pod.knows.idlab.ugent.be/profile/card#me> ;
              odrl:constraint ex:constraint .
ex:constraint odrl:leftOperand odrl:purpose ;
              odrl:operator odrl:eq ;
              odrl:rightOperand <http://example.com/client> .
```

## Adding or changing policies

For more details, see the [policy management API documentation](policy-management.md).

## Policy backups

Policies are stored in memory, meaning these will be lost when the AS is restarted.
To prevent this from happening,
there is a backup system which copies all policy data to a file every 5 minutes,
and reads it in again on server start.

By default, this is disabled.
To enable this, you have to edit the Components.js variables
which get passed along in [`packages/uma/bin/main.js`](../packages/uma/bin/main.js).
You want to change the line that defines the `urn:uma:variables:backupFilePath` variable,
and set the string value to the path where you want the backup file to be stored,
e.g., `backup.ttl`,
or you can use the `-f` CLI option when starting the server.
When restarting the server, the contents of that file will be read to initialize policies on the server.

## Data aggregation

The UMA server implements the [Aggregator Specification](https://spec.knows.idlab.ugent.be/aggregator-protocol/latest/).
