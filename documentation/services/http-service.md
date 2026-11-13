---
title: HTTP Service
nav_order: 3
parent: Services
description: How a request is prepared, sent with undici, recorded in the history and how its response body is stored.
---

# HTTP Service

Requests are sent by the main process. The renderer only names the request to send; main takes it from its model, so the request is sent exactly as main has it, including unsaved changes.

## Main process: `HttpService`

**Location**: `src/main/network/service/http-service.ts`

### `sendRequest(requestId, abortKey?)`

1. **Abort**: if an `abortKey` is given, an `AbortController` is registered under it before anything else, so `abortRequest(abortKey)` can cancel the request at any point. An aborted request returns `null` instead of a response.
2. **Prepare**: `CollectionStateService.prepareRequest(requestId)` writes the pending changes of the collection, then takes the request from the model and opens its text body and reads its scripts on the queue of the collection state. The `PreparedRequest` carries the model it was taken from.
3. **Record**: the rest runs inside `HistoryService.record()`, which adds the request to the history with its response or error and the output of its scripts.
4. **Send** (`fetchAsync()`):
   1. The **pre-request script** runs (`ScriptingService`) and returns the model it left behind. Everything below is resolved from that model, so a token the script sets is used.
   2. The URL is built and its variables resolved. An undefined variable fails with a `DisplayableError`.
   3. The authorization that applies (own or inherited) becomes the `Authorization` header, see [Variable Resolver]({% link documentation/services/variable-resolver.md %}#authorization).
   4. The body is prepared as a stream: a text body with its variables resolved on the fly, a file body from its file, form data as multipart. It is never read into memory.
   5. The headers are combined (automatic, inherited and own) and their variables resolved.
   6. `undici.request()` sends the request with the dispatcher of the collection.
   7. The response body is piped into the `BodyStore`.
   8. The **post-response script** runs; it can read the stored body.
5. **Result**: a `TrufosResponse` with the status, duration, size, headers and a reference to the stored body (`body.id`, `body.size`). The latest response body of each request is kept alive (`LatestResponseBodies`), because the response panel and the collection runner show it.

Any error is turned into a `DisplayableError` by `mapRequestError()`, see [Error Handling]({% link documentation/architecture/error-handling.md %}#network-errors).

### Dispatcher and TLS

`DispatcherCache` keeps one undici `Agent` for the open collection, so connections are reused. It is built from the app setting **Verify TLS certificates** and the client certificate of the collection, and replaced when either changes or the certificate files change on disk.

### Digest and OAuth

- **Digest**: before the actual request, `fetchChallenges()` sends it without a body to get the server's `WWW-Authenticate` challenge, like `curl --digest`.
- **OAuth 2.0 discovery**: `discoverOAuth2Endpoints(issuerUrl)` fetches the endpoints of an authorization server through OpenID Connect discovery (`openid-client`), with the TLS settings of the collection. The authorization editor uses it to fill in the token and authorization URLs from the issuer.

### `BodyStore`

**Location**: `src/main/network/service/body-store.ts`

Request and response bodies of the session are temporary files encrypted with AES-256-CTR and a key that only exists in memory. A file left behind by a crash can never be read. The history and `LatestResponseBodies` `retain()` a body while they reference it and `release()` it afterwards; a body without owners is deleted. CTR mode allows reading from any offset, which the MCP server uses to page through large bodies.

## Renderer: `HttpService`

**Location**: `src/renderer/services/http/http-service.ts`

`sendRequest(requestId, signal?)` calls the IPC method. An `AbortSignal` cannot cross IPC, so the service generates an abort key and calls `abortRequest(key)` when the signal fires. It returns `null` for a cancelled request and wraps any error that is not a `DisplayableError` in one.

Components do not call it directly: the collection store's `sendRequest` action first sends the pending editor changes of the request to main, and `useSendRequest()` adds the in-flight state, cancelling and the error toast.
