import { z } from 'zod';

/** The port the MCP server listens on unless the user chose another one. */
export const DEFAULT_MCP_SERVER_PORT = 7357;

/** The path of the MCP endpoint on the server. */
export const MCP_SERVER_PATH = '/mcp';

/** What a client of the MCP server may do. Tools that are not permitted are not offered. */
export enum McpPermission {
  /** Finding and reading the collection, environments, history and response bodies. */
  READ = 'read',
  /** Actions with effects outside the app, currently sending requests. */
  EXECUTE = 'execute',
  /** Changing requests, folders, text bodies, scripts and the selected environment. */
  EDIT = 'edit',
  /** Writing response bodies to files on disk. */
  WRITE_FILES = 'writeFiles',
}

export const McpPermissions = z.object({
  [McpPermission.READ]: z.boolean().default(true),
  [McpPermission.EXECUTE]: z.boolean().default(false),
  [McpPermission.EDIT]: z.boolean().default(false),
  [McpPermission.WRITE_FILES]: z.boolean().default(false),
});
export type McpPermissions = z.infer<typeof McpPermissions>;

/** The settings of the MCP server. It is off until the user enables it. */
export const McpServerSettings = z.object({
  enabled: z.boolean().default(false),
  port: z.int().min(1).max(65535).default(DEFAULT_MCP_SERVER_PORT),
  // `prefault` parses the empty object, so the permissions get their defaults
  permissions: McpPermissions.prefault({}),
});
export type McpServerSettings = z.infer<typeof McpServerSettings>;

/** Whether the MCP server runs, and if not, why. */
export type McpServerStatus =
  | { state: 'stopped' }
  | {
      state: 'running';
      /** The URL clients connect to. */
      url: string;
    }
  | {
      state: 'error';
      /** Why the server could not be started, e.g. because the port is taken. */
      message: string;
    };

/**
 * @param port the port of the server
 * @returns the URL clients connect to
 */
export function getMcpServerUrl(port: number): string {
  return `http://127.0.0.1:${port}${MCP_SERVER_PATH}`;
}
