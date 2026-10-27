import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { SettingsService } from 'main/persistence/service/settings-service';
import { type AppSettings, DEFAULT_APP_SETTINGS } from 'shim/app-settings';
import type { McpServerSettings } from 'shim/mcp';
import { McpServerService } from './mcp-server-service';

/** A stand-in for the HTTP server, as tests may not listen on ports. */
class FakeServer extends EventEmitter {
  static instances: FakeServer[] = [];
  /** Ports that are taken by another program. */
  static takenPorts = new Set<number>();

  port?: number;
  closed = false;

  constructor() {
    super();
    FakeServer.instances.push(this);
  }

  listen(port: number, _host: string, onListening: () => void) {
    if (FakeServer.takenPorts.has(port)) {
      const error = Object.assign(new Error(`listen EADDRINUSE ${port}`), { code: 'EADDRINUSE' });
      setImmediate(() => this.emit('error', error));
    } else {
      this.port = port;
      setImmediate(onListening);
    }
    return this;
  }

  close(onClosed: () => void) {
    this.closed = true;
    setImmediate(onClosed);
  }

  closeAllConnections() {}
}

vi.mock('node:http', () => ({ default: { createServer: () => new FakeServer() } }));

describe('McpServerService', () => {
  let settings: AppSettings;
  let service: McpServerService;

  function configure(changes: Partial<McpServerSettings>) {
    settings = { ...settings, mcpServer: { ...settings.mcpServer, ...changes } };
  }

  beforeEach(() => {
    FakeServer.instances = [];
    FakeServer.takenPorts.clear();
    settings = DEFAULT_APP_SETTINGS;
    vi.spyOn(SettingsService.instance, 'settings', 'get').mockImplementation(() => settings);
    service = new McpServerService();
  });

  afterEach(async () => {
    await service.stop();
    vi.restoreAllMocks();
  });

  it('should not run unless it is enabled', async () => {
    await service.update();

    expect(FakeServer.instances).toEqual([]);
    expect(service.status).toEqual({ state: 'stopped' });
  });

  it('should listen on the local machine while it is enabled', async () => {
    const statuses = vi.fn();
    service.on('status-changed', statuses);
    configure({ enabled: true, port: 4000 });

    await service.update();
    expect(FakeServer.instances[0].port).toBe(4000);
    expect(service.status).toEqual({ state: 'running', url: 'http://127.0.0.1:4000/mcp' });

    configure({ enabled: false });
    await service.update();
    expect(FakeServer.instances[0].closed).toBe(true);
    expect(statuses.mock.calls.map(([status]) => status.state)).toEqual(['running', 'stopped']);
  });

  it('should move to another port', async () => {
    configure({ enabled: true, port: 4000 });
    await service.update();

    configure({ port: 4001 });
    await service.update();

    expect(FakeServer.instances.map(({ port, closed }) => ({ port, closed }))).toEqual([
      { port: 4000, closed: true },
      { port: 4001, closed: false },
    ]);
    expect(service.status).toEqual({ state: 'running', url: 'http://127.0.0.1:4001/mcp' });
  });

  it('should report a port that is taken, and try again once the settings change', async () => {
    FakeServer.takenPorts.add(4000);
    configure({ enabled: true, port: 4000 });

    await service.update();
    expect(service.status).toEqual({
      state: 'error',
      message: 'Port 4000 is already in use. Choose another port.',
    });

    configure({ port: 4001 });
    await service.update();
    expect(service.status.state).toBe('running');
  });

  it('should keep running when only the permissions change', async () => {
    configure({ enabled: true, port: 4000 });
    await service.update();

    configure({ permissions: { ...settings.mcpServer.permissions, execute: true } });
    await service.update();

    expect(FakeServer.instances).toHaveLength(1);
    expect(FakeServer.instances[0].closed).toBe(false);
  });
});
