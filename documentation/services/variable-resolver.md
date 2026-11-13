---
title: Variable Resolver
nav_order: 1
parent: Services
description: How the main process resolves variables, inherited authorization and headers from the collection model.
---

# Variable Resolver

**Location**: `src/main/environment/service/variable-resolver.ts`, `system-variable.ts`

Variables, authorization and headers are resolved by plain functions, not by a service with state. Each takes the `CollectionModel` it resolves from as its first argument and never reads the current model itself. So everything one request needs is resolved from one consistent state: the model the request was prepared with, or the model its pre-request script left behind.

{: .note }
Earlier versions had an `EnvironmentService` that held the current collection. It is gone: the open collection is owned by the `CollectionStateService`, see [Main-Owned Collection State]({% link documentation/architecture/collection-state.md %}).

## Variables

Variables are looked up in this order; the first match wins:

1. Variables of the selected environment
2. Collection variables
3. System variables

| Function | Purpose |
| --- | --- |
| `getVariables(model)` | All variables as `[key, variable]` pairs, environment first |
| `getVariable(model, key)` | One variable, following the order above |
| `resolveVariablesInString(model, string, throwOnUndefinedVariable?)` | Replaces the templates in a string. With `throwOnUndefinedVariable`, an undefined variable throws an `UnmatchedVariableError` instead of staying in place. |
| `resolveVariablesInStream(model, stream)` | Replaces the templates in a stream with `template-replace-stream`, used for text bodies, so a body is never read into memory |

The syntax of a template is {% raw %}`{{name}}`{% endraw %}; spaces inside the braces are allowed. Users see this in [Variables]({% link documentation/user-guide/variables.md %}).

**System variables** (`system-variable.ts`) are computed on every use: `$timestampIso`, `$timestampUnix`, `$time`, `$date`, `$randomInt` and `$randomUuid`.

The renderer reads variables through IPC (`getActiveEnvironmentVariables()`, `getVariable()`, `resolveVariablesInString()`), e.g. for completion and hover in the editors or to preview a resolved URL. Main reads them on the queue of the collection state, so commands the renderer sent before are already applied.

## Authorization

- `resolveAuthorization(model, node)` (`src/shim/collection-model/model.ts`) returns the authorization that applies to a request or folder. If it is set to inherit, it takes the one of the closest folder above that has one, or else the collection's.
- `getAuthorizationHeader(model, auth, context)` resolves the variables in the top-level string fields of the authorization (tokens that OAuth 2.0 stored are kept as they are; they come from the token endpoint), creates the strategy for the authorization type (`createAuthStrategy()`, `src/main/network/authentication/`) and returns the value of the `Authorization` header. The context gives the strategies what they need from the request: OAuth 1.0 signs method and URL, Digest asks the server for a challenge first.

## Headers

Headers are resolved in `src/shim/collection-model/headers.ts`, so the renderer shows the same headers that main sends. `resolveHeaders(model, request, values)` combines:

- the **automatic** headers Trufos sets itself, e.g. `Content-Type` from the body, `Content-Length`, `Authorization` and `User-Agent`;
- the headers **inherited** from the collection and the folders above the request;
- the request's **own** headers, which override the others with the same name. A request can also disable inherited and automatic headers (`disabledHeaders`).

The `HttpService` then resolves the variables in the header values.
