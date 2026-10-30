import type { McpHttpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { Immutable } from 'immer';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { McpPermissions } from 'shim/mcp';
import { checkAccess, type Rejection } from './access-check';
import { createTrufosMcpHandler } from './mcp-handler';
import type { McpUiNotifier } from './tools/shared';

/*
 * Everything that uses the MCP SDK is reached from this module. `McpServerService` imports it only
 * once the server is enabled, so the SDK is not loaded for users who never enable it.
 */

/** Serves the HTTP requests of the MCP server. */
export interface McpRequestListener {
  /** Handles a request of the HTTP server. */
  listener: (request: IncomingMessage, response: ServerResponse) => void;
  /** The MCP handler, e.g. to notify clients or to close it. */
  handler: McpHttpHandler;
}

/**
 * Creates the listener for the HTTP server: requests that pass {@link checkAccess} are served by
 * the MCP handler.
 * @param getPermissions returns the current permissions
 * @param notifier shows what clients do in the app
 * @param isValidToken whether a token is the access token
 */
export function createRequestListener(
  getPermissions: () => Immutable<McpPermissions>,
  notifier: McpUiNotifier,
  isValidToken: (token: string) => boolean
): McpRequestListener {
  const handler = createTrufosMcpHandler(getPermissions, notifier);
  const handle = toNodeHandler(handler, {
    onerror: (error) => logger.error('Could not handle an MCP request:', error),
  });
  const listener = (request: IncomingMessage, response: ServerResponse) => {
    const rejection = checkAccess(request, isValidToken);
    if (rejection != null) return reject(response, rejection);
    void handle(request, response);
  };
  return { listener, handler };
}

/** Answers a rejected request with a JSON-RPC error, like the guards of the SDK do. */
function reject(response: ServerResponse, { status, message, headers }: Rejection) {
  response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  response.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }));
}
