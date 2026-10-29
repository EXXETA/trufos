# MCP Server

Issue: [#1088](https://github.com/EXXETA/trufos/issues/1088)

Agents can edit the files of a collection, and the app reloads them since #1073. But they cannot
send requests with the environments, variables and authorization of Trufos, nor read responses or
the history. Developers copy results between the agent and the app by hand.

Trufos gets an optional [MCP](https://modelcontextprotocol.io) server in the main process. It uses
the same services as the renderer, so whatever an agent does shows up live in the UI: sent requests
in the history and the response panel, edits as drafts in the sidebar and the editors.

## Goals and non-goals

Goals:

1. Agents find, read and send the requests of the open collection and read their responses and the
   history, with the variables and authorization of the app.
2. Agents create, edit, move and delete requests and folders, edit text bodies and scripts, and
   select the environment. Edits are drafts, like edits in the UI.
3. The user decides what the server may do: it is off by default, and the access token carries
   permissions that can be changed at any time.
4. Bodies are never read completely into memory, and never sent inline to the agent.

Non-goals:

- Access from other machines. The server only listens on `127.0.0.1`.
- Opening another collection. Switching collections stays a user action; see
  [Rejected alternatives](#rejected-alternatives).
- Confirmation dialogs per action. The token and its permissions are the consent.
- Running user scripts through MCP. Scripts can be edited, and they run when the request is sent,
  as they do when the user sends it.
- A stdio bridge, multiple tokens, or Trufos as an MCP client.

## Protocol and dependencies

The server uses the official TypeScript SDK, v2:

| Package                        | Purpose                                                               |
| ------------------------------ | --------------------------------------------------------------------- |
| `@modelcontextprotocol/server` | `McpServer`, tool registration and `createMcpHandler`                 |
| `@modelcontextprotocol/node`   | `toNodeHandler`, which serves the web-standard handler on `node:http` |

`createMcpHandler(factory, { legacy: 'stateless' })` serves clients of the 2026-07-28 revision of
the specification, and those of the 2025 revisions through the stateless fallback. The handler
creates a fresh `McpServer` from the factory for every HTTP request, so the server holds no session
state, and the factory registers exactly the tools the current permissions allow.

`@modelcontextprotocol/node` depends on `hono` and `@hono/node-server`, but only for its older
sessionful transport, which Trufos does not use. `toNodeHandler` and the request conversion do not
import them, so they are not part of the bundle.

Implementing the protocol ourselves on Zod was rejected: it would mean implementing both protocol
revisions, the upgrade of responses to SSE streams and subscriptions, and following every change of
the specification. The v1 package `@modelcontextprotocol/sdk` is the legacy line and pulls in
Express, CORS, AJV and more.

## Transport and security

The `McpServerService` (`src/main/mcp/`) owns the HTTP server. It listens on
`http://127.0.0.1:<port>/mcp` while the server is enabled, and starts, stops or restarts it whenever
the settings change. A port that is taken is reported as the status of the server, see
[Settings](#settings).

Every request passes these checks, in this order, before it reaches the MCP handler:

1. **Host**: the `Host` header must name `127.0.0.1`, `localhost` or `[::1]`. This rejects DNS
   rebinding, where a web page resolves its own domain to `127.0.0.1`.
2. **Origin**: a request with an `Origin` header must come from one of these hosts as well. Agents
   send no `Origin`; browsers always do for cross-origin requests.
3. **Token**: the `Authorization: Bearer <token>` header must match the access token, compared in
   constant time. Otherwise the answer is `401`.

The access token is 32 random bytes, encoded as base64url. It is created when the server is enabled
for the first time and stored encrypted with the `SecretService` in the user data directory, not in
`settings.json`. Regenerating it replaces it immediately; requests with the old token fail from then
on.

### Permissions

The token carries permissions. A tool that is not permitted is not registered, so it does not even
appear in `tools/list`. When the permissions change, the server notifies open subscriptions with
`notifications/tools/list_changed`.

| Permission   | Default | Allows                                                                                                     |
| ------------ | ------- | ---------------------------------------------------------------------------------------------------------- |
| `read`       | on      | Finding and reading the collection, environments, history and response bodies, showing a request in the UI |
| `execute`    | off     | Actions with effects outside the app, currently sending requests                                           |
| `edit`       | off     | Changing requests, folders, text bodies, scripts and the selected environment                              |
| `writeFiles` | off     | Writing response bodies to files on disk                                                                   |

### Secrets

Results do not contain the values of `secret` variables or stored credentials where they appear as
values of their own:

- The values of secret variables are replaced with `***`.
- The credential fields of authorizations (`password`, `token`, `clientSecret`, `consumerSecret`,
  `tokenSecret`, `codeVerifier`) are replaced with `***`.
- In the requests of the history, which were sent with all variables resolved, the values of the
  `Authorization`, `Proxy-Authorization` and `Cookie` headers are replaced with `***`. So are other
  header values, path segments, query values and script arguments that equal a secret, also
  URL-encoded.
- Only response bodies can be read, not the bodies of sent requests.

A secret is only masked where it is a whole value. Masking every occurrence inside longer text would
change data that merely contains it, e.g. `/admin/users` for a secret `admin`, and the agent could
not tell. So a secret inside a longer value (`Token <secret>`), a value derived from it (a
signature) and text that scripts log around it are returned as they are; a script argument that is a
secret is masked. Response bodies and headers are never
changed.

This keeps secrets out of the agent's context by default. **It is not a security boundary.** With
`execute` and `edit`, an agent can create a request that sends `{{apiKey}}` to a server that echoes it
back, or a script that does the same. Whoever holds a token with these permissions can learn the
secrets of the collection. The settings say so next to the permissions.

## Tools

All tools act on the open collection. Tools that take the ID of a request or folder fail with a
clear error if the collection has no such node. Request and folder IDs are the ones of the
collection model.

### `read`

| Tool                                            | Result                                                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_collections`                              | The recently opened collections (`id`, `title`, `dirPath`)                                                                                  |
| `get_collection`                                | The tree of folders and requests (`id`, `title`, `method`, `url`, `draft`), the environment keys and the selected environment               |
| `search(query, limit?)`                         | Requests and folders whose title, URL or method match all terms of the query, case-insensitively, with their folder path                    |
| `get_request(requestId)`                        | Method, URL, headers, disabled headers, body type and MIME type (and file path of a file body), authorization (masked), draft state, parent |
| `get_request_body(requestId, offset?, length?)` | A page of the text body, and its total size                                                                                                 |
| `get_request_script(requestId, scriptType)`     | The pre-request or post-response script                                                                                                     |
| `list_environments`                             | The environment keys, the selected one and the keys of their variables                                                                      |
| `get_variables(environment?)`                   | The variables that apply with the given or the selected environment (masked)                                                                |
| `get_history(limit?)`                           | The history of the open collection, newest first, as summaries                                                                              |
| `get_history_entry(entryId)`                    | A history entry with the sent request (masked), the response with its `bodyId`, and the script output                                       |
| `read_response_body(bodyId, offset?, length?)`  | A page of a response body, decoded as UTF-8, and its total size                                                                             |
| `open_request(requestId)`                       | Shows the request in the app, as if the user selected it in the sidebar                                                                     |

`search` matches the stored URL template, not the resolved URL, and does not search bodies or
scripts, which would mean reading every file of the collection.

### `execute`

The permission covers actions whose effects reach beyond the app. It is named for the kind of
action rather than for sending, so later actions of that kind, e.g. running the collection runner,
fall under it without a new permission.

`send_request(requestId)` sends the request through `HttpService.sendRequest`, exactly like the
send button: in its current state including unsaved changes, recorded in the history. Cancelling
the tool call aborts the request. The result contains the status, headers, duration, size, content
type, the `bodyId` and a text preview of the first 16 KiB of the body.

### `edit`

Every edit is a `CollectionCommand` applied by the `CollectionStateService`, so it is validated,
persisted and broadcast to the renderer like an edit in the UI. Changes to requests create drafts,
which the user can review and discard.

| Tool                                                      | Command                                                |
| --------------------------------------------------------- | ------------------------------------------------------ |
| `create_request(title, parentId?, method?, url?, index?)` | `CREATE_REQUEST`, as a draft                           |
| `create_folder(title, parentId?, index?)`                 | `CREATE_FOLDER`                                        |
| `update_request(requestId, changes)`                      | `EDIT_REQUEST` with `RequestChanges`                   |
| `edit_request_body(requestId, text)`                      | `SET_TEXT_BODY`                                        |
| `edit_request_script(requestId, scriptType, text)`        | `SET_SCRIPT`                                           |
| `rename(id, title)`                                       | `RENAME`                                               |
| `move(ids, parentId, index)`                              | `MOVE`                                                 |
| `delete(ids)`                                             | `DELETE`                                               |
| `save_request(requestId)`                                 | `SAVE_REQUEST`                                         |
| `discard_request(requestId)`                              | `DISCARD_REQUEST`                                      |
| `select_environment(key)`                                 | `UPDATE_COLLECTION` with only `selectedEnvironmentKey` |

`update_request` accepts the URL, method, headers, disabled headers, authorization and the body
type with its MIME type. Large request bodies are not passed inline: a body of type `file` with the
absolute path of a file the agent wrote is streamed from that file when the request is sent.

### `writeFiles`

`save_response_body(bodyId, path)` streams the decrypted body to an absolute path. The file is
opened with the `wx` flag, so an existing file is never overwritten.

## Bodies

Bodies are never read completely into memory:

- `BodyStore.openBody` gets a `start` option next to `end`. Previews and pages are streamed from
  the encrypted file with `start` and `end`. AES-256-CTR can be decrypted from any offset; the
  counter of the initialization vector is advanced to the block of `start`.
- Pages are limited to 64 KiB. A page may end in the middle of a multi-byte character; the result
  contains the byte range it covers, so the next page continues where it ended.
- Text bodies of requests are read the same way from their file. Scripts are read completely, as
  the editor holds them anyway.
- Full bodies are never part of a tool result, as a tool result is one JSON message that ends up in
  the model's context. Agents that need a whole body save it to a file.

A `bodyId` is valid while the history or the latest response of a request holds the body, at most
for the session of the app. Only those response bodies can be read; any other ID, including the IDs
of sent request bodies, fails with an error that says the body is no longer available.

## Live updates in the UI

- `send_request` pushes `MainProcessEvent.ResponseReceived` with the request ID and the response,
  so the response panel shows it. The history updates through `HistoryChanged`, as it does today.
- Edits are broadcast as patches like those of the renderer. `edit_request_body` and
  `edit_request_script` change files that are not part of the model, so they emit
  `request-files-changed`, and the editors reload them. Pending edits of the user win over the
  reload, as for changes outside the app.
- `open_request` pushes `MainProcessEvent.ShowRequest`, and the renderer selects the request with
  `setSelectedRequest`, which flushes the pending edits of the previous request first.

## Settings

`AppSettings` gets a `mcpServer` section:

```ts
mcpServer: {
  enabled: false,
  port: 7357,
  permissions: { read: true, execute: false, edit: false, writeFiles: false },
}
```

The app settings get an **MCP Server** tab with:

- a switch to enable the server and the port,
- the status of the server (running, stopped, or the error, e.g. a port that is taken),
- the URL and the token to copy, the token masked until revealed, and a button to regenerate it,
- the permissions, with the warning from [Secrets](#secrets),
- a configuration to paste into a client, e.g.
  `claude mcp add --transport http trufos http://127.0.0.1:7357/mcp --header "Authorization: Bearer <token>"`.

The renderer reads the status with `getMcpServerStatus()` and is kept up to date with
`MainProcessEvent.McpServerStatusChanged`. The token is read with `getMcpToken()` and replaced with
`regenerateMcpToken()`.

## Rejected alternatives

- **Agents edit the files directly:** they cannot send requests or read responses.
- **A plugin:** plugins are activated lazily, but the server has to run from startup.
- **A stdio bridge:** possible later, HTTP first, as the agent does not start Trufos.
- **MCP resources for bodies:** `resources/read` returns a resource in one message.
- **`open_collection` with a permission dialog:** feasible, but the renderer would have to flush
  its pending editor edits before main switches the collection, which needs a handshake like the
  one before closing the window. Postponed.
- **Confirming actions in the UI:** the token and its permissions are the consent. Dialogs would
  block agents until the user reacts.
