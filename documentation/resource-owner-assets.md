# Resource Owner Assets

The resource-owner assets endpoint lets a policy management client discover the UMA resources that a resource owner can manage.
It is exposed by the authorization server at the URL advertised as `resource_owner_assets_endpoint` in the UMA discovery document.
With the default routes this is:

```text
GET /uma/resource-owner/assets
GET /uma/resource-owner/assets/{id}
```

The endpoint is intended for policy management clients.
It bridges the gap between resource registration and policy management by telling the client which registered resource identifiers exist,
which scopes they support, and whether the owner already has a non-system policy for them.

## Authentication

Every request must authenticate the resource owner.
The server parses the request credentials, verifies them, and uses the
`urn:solidlab:uma:claims:types:webid` claim as the resource owner identifier.
If no WebID claim is present, the request is rejected.

The response only contains registrations whose stored owner matches the authenticated WebID.
When requesting a single asset, the server returns:

- `404` if the asset identifier is unknown.
- `403` if the asset exists but belongs to another resource owner.

## Listing Assets

`GET /uma/resource-owner/assets` returns the registered assets owned by the authenticated resource owner:

```json
{
  "assets": [
    {
      "_id": "http://localhost:3000/alice/private/resource.txt",
      "resource_server": "http://localhost:3000/",
      "registered_at": "2026-05-18T13:20:00Z",
      "updated_at": "2026-05-18T13:20:00Z",
      "is_new": true,
      "policy": {
        "status": "missing",
        "policy_uri": "http://localhost:4000/uma/policies/assets/http%3A%2F%2Flocalhost%3A3000%2Falice%2Fprivate%2Fresource.txt"
      }
    }
  ]
}
```

The list is sorted by `registered_at`, newest first.

### Query Parameters

The list endpoint accepts these query parameters:

| Parameter | Meaning |
| --- | --- |
| `include` | Comma-separated list of optional fields to include. Valid values are `description`, `scopes`, `policies`, and `policy_uri`. If omitted, only `policy_uri` is included. |
| `resource_server` | Only return registrations from this resource server. The value must exactly match the stored resource server URI. |
| `new_since` | Only return assets registered after this timestamp. The value must parse as a JavaScript date. |
| `updated_since` | Only return assets updated after this timestamp. The value must parse as a JavaScript date. |
| `watch=true` | Return a Server-Sent Events stream instead of a normal JSON response. |
| `sse=true` | Alias for `watch=true`. |

Unknown `include` values or invalid timestamps result in a bad request response.

### Include Values

The base asset object contains:

- `_id`: the UMA resource identifier.
- `resource_server`: the resource server that registered the asset, if known.
- `registered_at`: the registration timestamp.
- `updated_at`: the last registration update timestamp.
- `is_new`: only present in list responses. It is `true` when the policy status is `missing`.

Optional fields are controlled by `include`:

- `description` adds the resource description fields, excluding scopes.
- `scopes` adds `description.resource_scopes`.
- `policies` adds `policy.status`.
- `policy_uri` adds `policy.policy_uri`; this also creates the `policy` object.

For example:

```text
GET /uma/resource-owner/assets?include=description,scopes,policies,policy_uri
```

returns assets with their description, supported scopes, policy status, and policy management URI.

## Reading One Asset

`GET /uma/resource-owner/assets/{id}` returns one owned asset.
The `{id}` path parameter is the resource identifier.

Single-asset responses always include all optional details:

```json
{
  "_id": "http://localhost:3000/alice/private/resource.txt",
  "resource_server": "http://localhost:3000/",
  "registered_at": "2026-05-18T13:20:00Z",
  "updated_at": "2026-05-18T13:20:00Z",
  "description": {
    "name": "http://localhost:3000/alice/private/resource.txt",
    "resource_scopes": [
      "urn:example:css:modes:read",
      "urn:example:css:modes:write"
    ]
  },
  "policy": {
    "status": "configured",
    "policy_uri": "http://localhost:4000/uma/policies/assets/http%3A%2F%2Flocalhost%3A3000%2Falice%2Fprivate%2Fresource.txt"
  }
}
```

## Policy Status

The endpoint reports policy state from the policy store:

- `configured`: there is a non-system ODRL `Agreement` or `Set` with a permission assigned by the authenticated owner and targeting the asset or one of its `odrl:partOf` collections.
- `missing`: no such policy exists.

Owner access policies created internally by the server are ignored for this status.
This means `missing` identifies assets that still need a user-managed policy, even if the server has internal owner-access rules for them.

The `policy_uri` points to the policy management API for that asset:

```text
/uma/policies/assets/{encodedAssetId}
```

A policy management client can use this as the policy identifier when creating or updating policy data through
the policy management API.

## Server-Sent Events

The list and single-asset endpoints can also be consumed as Server-Sent Events.
The server switches to SSE when any of these are true:

- The request has `Accept: text/event-stream`.
- The query contains `watch=true`.
- The query contains `sse=true`.

The response has:

```text
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

The first event is always a `snapshot`.
For the list endpoint the snapshot contains the same shape as the normal list response:

```text
event: snapshot
data: {"assets":[{"_id":"...","policy":{"policy_uri":"..."}}]}
```

For the single-asset endpoint the snapshot contains the single asset object.
If the asset no longer exists or is not owned by the authenticated owner when the stream starts, no snapshot is written.

After the snapshot, the stream emits resource registration changes for the authenticated owner:

| Event | Data |
| --- | --- |
| `asset-created` | The created asset object. |
| `asset-updated` | The updated asset object. |
| `asset-deleted` | At least the deleted asset `_id`; list streams also include `resource_server` when known. |
| `error` | `{ "message": "..." }` if an asynchronous stream operation fails. |

List streams apply the same `include`, `resource_server`, `new_since`, and `updated_since` filters to the initial snapshot and later events.
Events for other resource owners are ignored.
Single-asset streams only emit events for the requested asset identifier.

The stream writes a comment heartbeat every 30 seconds:

```text
: keep-alive
```

When the client closes the stream, the server unsubscribes from the in-process asset event emitter.

## Example SSE Client

```js
const endpoint = 'http://localhost:4000/uma/resource-owner/assets?include=description,scopes,policies,policy_uri';
const events = new EventSource(`${endpoint}&watch=true`);

events.addEventListener('snapshot', (event) => {
  const { assets } = JSON.parse(event.data);
  console.log('initial assets', assets);
});

events.addEventListener('asset-created', (event) => {
  console.log('created', JSON.parse(event.data));
});

events.addEventListener('asset-updated', (event) => {
  console.log('updated', JSON.parse(event.data));
});

events.addEventListener('asset-deleted', (event) => {
  console.log('deleted', JSON.parse(event.data));
});
```

If the client library cannot attach the required authorization header to `EventSource`,
use a fetch-based SSE client or another implementation that supports authenticated requests.
