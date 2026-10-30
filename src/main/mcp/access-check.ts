import {
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  validateHostHeader,
  validateOriginHeader,
} from '@modelcontextprotocol/server';
import type { IncomingHttpHeaders } from 'node:http';
import { MCP_SERVER_PATH } from 'shim/mcp';

/** Why a request to the MCP server is rejected, as the HTTP response to send. */
export interface Rejection {
  status: number;
  message: string;
  headers?: Record<string, string>;
}

/**
 * Checks a request before it reaches the MCP handler:
 * 1. The `Host` header must name the local machine. This rejects DNS rebinding, where a web page
 *    resolves its own domain to `127.0.0.1`.
 * 2. A request with an `Origin` header must come from the local machine, too. Agents send none,
 *    browsers do.
 * 3. The path must be the MCP endpoint.
 * 4. The `Authorization: Bearer <token>` header must carry the access token.
 * @param request the method-independent parts of the request
 * @param isValidToken whether a token is the access token
 * @returns why the request is rejected, or undefined if it may proceed
 */
export function checkAccess(
  request: { url?: string; headers: IncomingHttpHeaders },
  isValidToken: (token: string) => boolean
): Rejection | undefined {
  const { headers } = request;
  const host = validateHostHeader(headers.host, localhostAllowedHostnames());
  if (!host.ok) return { status: 403, message: host.message };
  const origin = validateOriginHeader(headers.origin, localhostAllowedOrigins());
  if (!origin.ok) return { status: 403, message: origin.message };
  if (new URL(request.url ?? '/', 'http://localhost').pathname !== MCP_SERVER_PATH) {
    return { status: 404, message: 'Not found' };
  }
  if (!isValidToken(getBearerToken(headers.authorization))) {
    return {
      status: 401,
      message: 'Missing or invalid access token',
      headers: { 'WWW-Authenticate': 'Bearer' },
    };
  }
  return undefined;
}

/** Returns the token of an `Authorization: Bearer <token>` header, or an empty string. */
function getBearerToken(authorization: string | undefined): string {
  return /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? '')?.[1] ?? '';
}
