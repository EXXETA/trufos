import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS } from 'shim/app-settings';
import { MainProcessEvent } from 'shim/event-service';
import type { McpServerSettings, McpServerStatus } from 'shim/mcp';
import { AppMcpTab } from './AppMcpTab';

const { eventService, settingsState, updateSettingsMock, listeners } = vi.hoisted(() => {
  const listeners = new Map<string, (event: unknown, payload: unknown) => void>();
  const eventService = {
    on: vi.fn((event: string, listener: (event: unknown, payload: unknown) => void) => {
      listeners.set(event, listener);
      return eventService;
    }),
    removeListener: vi.fn(() => eventService),
    getMcpServerStatus: vi.fn(),
    getMcpToken: vi.fn(),
    regenerateMcpToken: vi.fn(),
  };
  return {
    eventService,
    listeners,
    settingsState: { mcpServer: {} as McpServerSettings },
    updateSettingsMock: vi.fn(),
  };
});

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: eventService },
}));

vi.mock('@/state/appSettingsStore', () => ({
  useAppSettingsStore: (selector: (state: typeof settingsState) => unknown) =>
    selector(settingsState),
  useAppSettingsActions: () => ({ updateSettings: updateSettingsMock }),
}));

function configure(changes: Partial<McpServerSettings>) {
  settingsState.mcpServer = { ...settingsState.mcpServer, ...changes };
}

describe('AppMcpTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listeners.clear();
    settingsState.mcpServer = DEFAULT_APP_SETTINGS.mcpServer;
    eventService.getMcpServerStatus.mockResolvedValue({ state: 'stopped' });
    eventService.getMcpToken.mockResolvedValue('the-token');
    eventService.regenerateMcpToken.mockResolvedValue('new-token');
  });

  it('enables the server', async () => {
    render(<AppMcpTab />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Enable MCP server' }));

    expect(updateSettingsMock).toHaveBeenCalledWith({
      mcpServer: { ...DEFAULT_APP_SETTINGS.mcpServer, enabled: true },
    });
  });

  it('does not create a token while the server is disabled', async () => {
    render(<AppMcpTab />);

    await screen.findByText('Stopped');
    expect(eventService.getMcpToken).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Access token')).toBeNull();
  });

  it('shows the URL and the masked token of an enabled server', async () => {
    configure({ enabled: true, port: 4000 });

    render(<AppMcpTab />);

    expect(screen.getByLabelText<HTMLInputElement>('URL').value).toBe('http://127.0.0.1:4000/mcp');
    const token = screen.getByLabelText<HTMLInputElement>('Access token');
    await waitFor(() => expect(token.value).toBe('the-token'));
    expect(token.type).toBe('password');
  });

  it('regenerates the token', async () => {
    configure({ enabled: true });
    render(<AppMcpTab />);

    await userEvent.click(screen.getByRole('button', { name: 'Regenerate' }));

    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>('Access token').value).toBe('new-token')
    );
  });

  it('follows the status of the server', async () => {
    render(<AppMcpTab />);
    await screen.findByText('Stopped');

    const status: McpServerStatus = { state: 'error', message: 'Port 7357 is already in use.' };
    act(() => listeners.get(MainProcessEvent.McpServerStatusChanged)?.(undefined, status));

    expect(screen.getByText('Error')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Port 7357 is already in use.');
  });

  it('changes a permission', async () => {
    render(<AppMcpTab />);

    await userEvent.click(screen.getByRole('checkbox', { name: /Execute/ }));

    expect(updateSettingsMock).toHaveBeenCalledWith({
      mcpServer: {
        ...DEFAULT_APP_SETTINGS.mcpServer,
        permissions: { ...DEFAULT_APP_SETTINGS.mcpServer.permissions, execute: true },
      },
    });
  });

  it('only stores a valid port once the input is left', async () => {
    render(<AppMcpTab />);
    const port = screen.getByLabelText('Port');

    await userEvent.clear(port);
    await userEvent.type(port, '70000');
    await userEvent.tab();
    expect(screen.getByText('The port must be a number from 1 to 65535.')).toBeTruthy();
    expect(updateSettingsMock).not.toHaveBeenCalled();

    await userEvent.clear(port);
    await userEvent.type(port, '8000{Enter}');
    expect(updateSettingsMock).toHaveBeenCalledWith({
      mcpServer: { ...DEFAULT_APP_SETTINGS.mcpServer, port: 8000 },
    });
  });
});
