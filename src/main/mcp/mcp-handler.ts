import { createMcpHandler, McpServer, type McpHttpHandler } from '@modelcontextprotocol/server';
import { app } from 'electron';
import type { Immutable } from 'immer';
import type { McpPermissions } from 'shim/mcp';
import { registerEditTools } from './tools/edit-tools';
import { registerExecuteTools } from './tools/execute-tools';
import { registerFileTools } from './tools/file-tools';
import { registerReadTools } from './tools/read-tools';
import type { McpUiNotifier } from './tools/shared';

/** What clients are told about the server when they connect. */
const INSTRUCTIONS =
  'Trufos is a REST client. Its collections hold requests in folders, environments and ' +
  'variables. The tools act on the collection the user has open in Trufos. Requests use ' +
  '`{{variable}}` templates, which are resolved when a request is sent. Find requests with ' +
  '`search` or `get_collection`. Changes to requests are drafts until they are saved, like ' +
  'unsaved edits in the app. Values of secret variables and credentials are masked.';

/**
 * Creates the web-standard MCP handler. It serves clients of the current protocol revision and,
 * statelessly, those of the 2025 revisions. Each request is served by a fresh MCP server that only
 * offers the tools the permissions allow at that moment.
 * @param getPermissions returns the current permissions
 * @param notifier shows what clients do in the app
 */
export function createTrufosMcpHandler(
  getPermissions: () => Immutable<McpPermissions>,
  notifier: McpUiNotifier
): McpHttpHandler {
  const createServer = () => {
    const server = new McpServer(
      { name: 'trufos', title: 'Trufos', version: app.getVersion() },
      { instructions: INSTRUCTIONS }
    );
    const permissions = getPermissions();
    if (permissions.read) registerReadTools(server, notifier);
    if (permissions.execute) registerExecuteTools(server, notifier);
    if (permissions.edit) registerEditTools(server);
    if (permissions.writeFiles) registerFileTools(server);
    return server;
  };
  return createMcpHandler(createServer, {
    legacy: 'stateless',
    onerror: (error) => logger.warn('MCP request failed:', error),
  });
}
