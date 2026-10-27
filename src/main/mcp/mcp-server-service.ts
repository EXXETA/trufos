import type { McpHttpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { Immutable } from 'immer';
import { EventEmitter } from 'node:events';
import http, { type ServerResponse } from 'node:http';
import { isDeepStrictEqual } from 'node:util';
import { SettingsService } from 'main/persistence/service/settings-service';
import type { Initializable } from 'main/shared/initializable';
import { SerialQueue } from 'main/util/serial-queue';
import { isErrnoException } from 'main/util/fs-util';
import { getMcpServerUrl, type McpPermissions, type McpServerStatus } from 'shim/mcp';
import type { TrufosResponse } from 'shim/objects/response';
import { checkAccess, type Rejection } from './access-check';
import { McpAccessToken } from './access-token';
import { createTrufosMcpHandler } from './mcp-handler';
import type { McpUiNotifier } from './tools/shared';

const settingsService = SettingsService.instance;
const accessToken = McpAccessToken.instance;

/** Event signatures emitted by the {@link McpServerService}. */
type McpServerServiceEvents = {
  /** The server started, stopped or failed to start. */
  'status-changed': [status: McpServerStatus];
  /** A client sent a request. The response panel of the app shows its response. */
  'response-received': [requestId: string, response: TrufosResponse];
  /** A client asked to show a request in the app. */
  'show-request': [requestId: string];
};

/** The server while it runs. */
interface RunningServer {
  server: http.Server;
  handler: McpHttpHandler;
  port: number;
  /** The permissions the tools of the server were last offered with. */
  permissions: Immutable<McpPermissions>;
}

/**
 * Runs the MCP server agents use to work with the app, see `docs/architecture/05_mcp_server.md`.
 * The server listens on `127.0.0.1` while it is enabled in the settings, and follows changes of
 * the settings. Requests are checked by {@link checkAccess} before the MCP handler serves them.
 */
export class McpServerService
  extends EventEmitter<McpServerServiceEvents>
  implements Initializable, McpUiNotifier
{
  public static readonly instance = new McpServerService();

  /** Starting and stopping the server, one after another. */
  private readonly queue = new SerialQueue();

  private running?: RunningServer;

  private _status: McpServerStatus = { state: 'stopped' };

  /** Whether the server runs, and if not, why. */
  public get status(): McpServerStatus {
    return this._status;
  }

  /** Starts the server if it is enabled, and follows changes of the settings afterwards. */
  public async init(): Promise<void> {
    settingsService.on('changed', () => void this.update());
    await this.update();
  }

  /** Starts, stops or restarts the server as the settings say. Failures become the status. */
  public update(): Promise<void> {
    return this.queue.run(() => this.applySettings());
  }

  /** Stops the server, e.g. when the app quits. */
  public stop(): Promise<void> {
    return this.queue.run(() => this.close());
  }

  public responseReceived(requestId: string, response: TrufosResponse): void {
    this.emit('response-received', requestId, response);
  }

  public showRequest(requestId: string): void {
    this.emit('show-request', requestId);
  }

  private async applySettings() {
    const { enabled, port, permissions } = settingsService.settings.mcpServer;
    if (this.running != null) {
      if (enabled && this.running.port === port) {
        if (!isDeepStrictEqual(this.running.permissions, permissions)) {
          // the next request is served with the new tools; listening clients reload them
          this.running.permissions = permissions;
          this.running.handler.notify.toolsChanged();
        }
        return;
      }
      await this.close();
    }
    if (!enabled) return this.setStatus({ state: 'stopped' });

    try {
      this.running = await this.listen(port);
      this.setStatus({ state: 'running', url: getMcpServerUrl(port) });
      logger.info(`MCP server listening on ${getMcpServerUrl(port)}`);
    } catch (error) {
      logger.error('Could not start the MCP server:', error);
      this.setStatus({ state: 'error', message: describeListenError(error, port) });
    }
  }

  private async listen(port: number): Promise<RunningServer> {
    // read before the first request arrives, as requests are checked synchronously
    await accessToken.get();

    const handler = createTrufosMcpHandler(
      () => settingsService.settings.mcpServer.permissions,
      this
    );
    const handle = toNodeHandler(handler, {
      onerror: (error) => logger.error('Could not handle an MCP request:', error),
    });
    const server = http.createServer((request, response) => {
      const rejection = checkAccess(request, (token) => accessToken.matches(token));
      if (rejection != null) return reject(response, rejection);
      void handle(request, response);
    });

    try {
      await new Promise<void>((resolve, rejectListen) => {
        server.once('error', rejectListen);
        server.listen(port, '127.0.0.1', () => {
          server.off('error', rejectListen);
          resolve();
        });
      });
    } catch (error) {
      await handler.close();
      throw error;
    }
    server.on('error', (error) => logger.error('MCP server error:', error));
    return { server, handler, port, permissions: settingsService.settings.mcpServer.permissions };
  }

  private async close() {
    const running = this.running;
    if (running == null) return;
    this.running = undefined;
    await running.handler.close();
    const closed = new Promise<void>((resolve) => running.server.close(() => resolve()));
    // streamed responses would keep the server open
    running.server.closeAllConnections();
    await closed;
    this.setStatus({ state: 'stopped' });
    logger.info('MCP server stopped');
  }

  private setStatus(status: McpServerStatus) {
    if (isDeepStrictEqual(status, this._status)) return;
    this._status = status;
    this.emit('status-changed', status);
  }
}

/** Answers a rejected request with a JSON-RPC error, like the guards of the SDK do. */
function reject(response: ServerResponse, { status, message, headers }: Rejection) {
  response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  response.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }));
}

/** Explains why the server could not listen on the port, in terms of the settings. */
function describeListenError(error: unknown, port: number): string {
  const code = isErrnoException(error) ? error.code : undefined;
  if (code === 'EADDRINUSE') return `Port ${port} is already in use. Choose another port.`;
  if (code === 'EACCES') return `Trufos may not use port ${port}. Choose another port.`;
  return error instanceof Error ? error.message : String(error);
}
