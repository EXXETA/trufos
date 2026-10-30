import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PluginFileArea,
  type PluginInfo,
  PluginPermissionAccess,
  PluginPermissionScope,
} from 'shim/plugin';
import { AppPluginsTab } from './AppPluginsTab';

const { setEnabledMock, pluginState } = vi.hoisted(() => ({
  setEnabledMock: vi.fn(),
  pluginState: { plugins: [] as PluginInfo[] },
}));

vi.mock('@/state/pluginStore', () => ({
  selectPlugins: (state: typeof pluginState) => state.plugins,
  usePluginActions: () => ({ setEnabled: setEnabledMock }),
  usePluginStore: (selector: (state: typeof pluginState) => unknown) => selector(pluginState),
}));

function plugin(overrides: Partial<PluginInfo> = {}): PluginInfo {
  return {
    id: 'git',
    name: 'Git',
    version: '1.2.0',
    description: 'Commits and pushes collections.',
    permissions: [],
    enabled: true,
    ...overrides,
  };
}

describe('AppPluginsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pluginState.plugins = [];
  });

  it('says so when no plugins are installed', () => {
    render(<AppPluginsTab />);

    expect(screen.getByText('No plugins are installed.')).toBeTruthy();
  });

  it('shows a plugin with its version, description and permissions', () => {
    pluginState.plugins = [
      plugin({
        permissions: [
          { scope: PluginPermissionScope.COLLECTION, value: PluginPermissionAccess.READ },
          { scope: PluginPermissionScope.NETWORK, value: '*.github.com' },
          { scope: PluginPermissionScope.EXEC, value: 'git' },
        ],
      }),
    ];

    render(<AppPluginsTab />);

    expect(screen.getByText('Git')).toBeTruthy();
    expect(screen.getByText('1.2.0')).toBeTruthy();
    expect(screen.getByText('Commits and pushes collections.')).toBeTruthy();
    const permissions = within(screen.getByRole('list', { name: 'Permissions' }));
    expect(permissions.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Read the open collection',
      'Connect to *.github.com',
      'Run the program git',
    ]);
  });

  it.each([PluginFileArea.PICK, PluginFileArea.COLLECTION])(
    'says that the file permission "%s" is not limited to certain files',
    (value) => {
      pluginState.plugins = [plugin({ permissions: [{ scope: PluginPermissionScope.FS, value }] })];

      render(<AppPluginsTab />);

      expect(screen.getByRole('listitem').textContent).toBe('Access any file on your computer');
    }
  );

  it('shows permissions that read the same only once', () => {
    pluginState.plugins = [
      plugin({
        permissions: [
          { scope: PluginPermissionScope.FS, value: PluginFileArea.PICK },
          { scope: PluginPermissionScope.FS, value: PluginFileArea.COLLECTION },
        ],
      }),
    ];

    render(<AppPluginsTab />);

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('says so when a plugin needs no permissions', () => {
    pluginState.plugins = [plugin()];

    render(<AppPluginsTab />);

    expect(screen.getByText('Needs no permissions.')).toBeTruthy();
  });

  it('shows why a plugin cannot be used', () => {
    pluginState.plugins = [plugin({ error: 'Requires plugin API ^2.0.0' })];

    render(<AppPluginsTab />);

    expect(screen.getByText('Requires plugin API ^2.0.0')).toBeTruthy();
  });

  it('shows each plugin as its own entry', () => {
    pluginState.plugins = [plugin(), plugin({ id: 'jira', name: 'Jira' })];

    render(<AppPluginsTab />);

    expect(screen.getByRole('article', { name: 'Git' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Jira' })).toBeTruthy();
  });

  it('disables an enabled plugin', async () => {
    pluginState.plugins = [plugin()];
    render(<AppPluginsTab />);
    const checkbox = screen.getByRole('checkbox', { name: /Git/ });
    expect(checkbox.getAttribute('aria-checked')).toBe('true');

    await userEvent.click(checkbox);

    expect(setEnabledMock).toHaveBeenCalledExactlyOnceWith('git', false);
  });

  it('enables a disabled plugin', async () => {
    pluginState.plugins = [plugin({ enabled: false })];
    render(<AppPluginsTab />);

    await userEvent.click(screen.getByRole('checkbox', { name: /Git/ }));

    expect(setEnabledMock).toHaveBeenCalledExactlyOnceWith('git', true);
  });
});
