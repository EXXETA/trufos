---
title: HTTP Service
nav_order: 3
parent: Core Services
---

# HTTP Service

The HTTP Service is responsible for making outgoing HTTP requests as defined by the user. It primarily resides in the main process, leveraging Node.js capabilities for network operations.

## Main Process `HttpService`

*   **Location**: `src/main/network/service/http-service.ts`
*   **Core Library**: Uses [`undici`](https://undici.nodejs.org/), a fast and spec-compliant HTTP/1.1 client for Node.js.
*   **Singleton**: `HttpService.instance` provides a global instance. An optional `Dispatcher` can be passed to the constructor, primarily for testing with `MockAgent` from `undici`.

### Key Method: `fetchAsync(request: TrufosRequest)`

This is the primary method for sending requests.

1.  **Timing**: Records a timestamp before starting the request using `getSteadyTimestamp()` for accurate duration measurement.
2.  **Request Body Processing**:
    *   Calls `readBody(request)` to prepare the request body:
        *   If `request.body` is `null`, no body is sent.
        *   If `request.body.type` is `'text'`:
            *   Loads the text body content using `PersistenceService.loadTextBodyOfRequest(request)`. This returns a `Readable` stream.
            *   The stream is then piped through `EnvironmentService.setVariablesInStream()` to substitute any template variables (e.g., `{{my_var}}`).
        *   If `request.body.type` is `'file'`:
            *   Uses `FileSystemService.readFile(request.body.filePath)` to get a `Readable` stream for the specified file.
    *   Determines the `Content-Type` header based on `request.body.mimeType` or defaults (e.g., `text/plain`, `application/octet-stream`).
3.  **Making the Request**:
    *   Uses `undici.request(url, options)` to send the HTTP request.
    *   **Options include**:
        *   `dispatcher`: Uses the internal `_dispatcher` (if provided, for tests) or `undici`'s default.
        *   `method`: From `request.method`.
        *   `headers`: Merges the determined `Content-Type` with headers from `request.headers` (converted from `TrufosHeader[]` to `undici`'s expected format). Inactive headers are skipped.
        *   `body`: The processed `Readable` stream from step 2.
4.  **Response Handling**:
    *   `responseData` (from `undici.request`) contains `statusCode`, `headers`, and `body` (an `undici` `Readable` stream).
    *   Calculates the request `duration` using `getDurationFromNow()`.
    *   **Response Body Storage**:
        *   Creates a temporary file using `FileSystemService.temporaryFile()`.
        *   If `responseData.body` is not null, it's piped to a `fs.WriteStream` associated with the temporary file. This efficiently saves large response bodies to disk instead of keeping them in memory.
5.  **Result Construction**:
    *   Creates a `TrufosResponse` object:
        *   `metaInfo`:
            *   `status`: From `responseData.statusCode`.
            *   `duration`: Calculated duration.
            *   `size`: Calculated using `calculateResponseSize(responseData.headers, bodyFile.name)`. This utility (`src/main/util/size-calculation.ts`) estimates header size and reads body size (either from `Content-Length` header or temporary file stats).
        *   `headers`: `responseData.headers` (frozen for immutability).
        *   `bodyFilePath`: Path to the temporary file containing the response body, or `null` if no body.
    *   Logs and returns the `TrufosResponse`.

### Helper Methods:

*   **`readBody(request)`**: As described above, prepares the request body stream.
*   **`getContentType(request)`**: Determines the `Content-Type` for the request.
*   **`trufosHeadersToUndiciHeaders(trufosHeaders)`**: Converts the application's `TrufosHeader[]` format to the `Record<string, string[]>` format expected by `undici`.

## Renderer Process `HttpService`

*   **Location**: `src/renderer/services/http/http-service.ts`
*   **Purpose**: This is a very thin wrapper around `RendererEventService.sendRequest`.
*   **`sendRequest(request: TrufosRequest)`**:
    *   Calls `RendererEventService.instance.sendRequest(request)`.
    *   Catches errors (including `MainProcessError` from the event service).
    *   If the error is already a `DisplayableError`, it re-throws it.
    *   Otherwise, it attempts to create a more user-friendly `DisplayableError` based on common network error messages (e.g., "invalid url", "getaddrinfo ENOTFOUND") or falls back to a generic error message.

The main HTTP logic resides in the main process to leverage Node.js's networking capabilities and to handle potentially large data streams efficiently without blocking the UI. The renderer-side service primarily acts as an error-handling and presentation layer. 